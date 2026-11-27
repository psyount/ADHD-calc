import Foundation

/// 한 번의 복용.
public struct DoseEvent: Hashable, Sendable {
    public var drugID: String
    public var mg: Double
    public var time: Date
    public var withFood: Bool

    public init(drugID: String, mg: Double, time: Date, withFood: Bool = false) {
        self.drugID = drugID
        self.mg = mg
        self.time = time
        self.withFood = withFood
    }

    public var drug: DrugDefinition? { DrugCatalog.drug(id: drugID) }
}

/// 개인 보정 가능한 매개변수 + 체중.
public struct ModelSettings: Codable, Hashable, Sendable {
    public var weightKg: Double
    public var orosReleaseHours: Double
    /// MPH 효과 기준선 (그날 최고치 대비 %)
    public var mphEffectThresholdPercent: Double
    /// 카페인 수면 기준선 (ng/mL)
    public var caffeineSleepThreshold: Double

    public static let defaultWeightKg = 70.0
    /// 균등 방출 근사에서 피크는 방출이 끝나는 시점 근처에 온다.
    /// 7시간이면 복용 후 약 7.1시간에 피크 (스크린샷과 비슷).
    public static let defaultOrosReleaseHours = 7.0
    public static let defaultMphEffectThreshold = 50.0
    public static let defaultCaffeineSleepThreshold = 1000.0

    public init(weightKg: Double = ModelSettings.defaultWeightKg,
                orosReleaseHours: Double = ModelSettings.defaultOrosReleaseHours,
                mphEffectThresholdPercent: Double = ModelSettings.defaultMphEffectThreshold,
                caffeineSleepThreshold: Double = ModelSettings.defaultCaffeineSleepThreshold) {
        self.weightKg = weightKg
        self.orosReleaseHours = orosReleaseHours
        self.mphEffectThresholdPercent = mphEffectThresholdPercent
        self.caffeineSleepThreshold = caffeineSleepThreshold
    }

    public static let standard = ModelSettings()
}

public struct CurvePoint: Hashable, Sendable, Codable {
    public var date: Date
    public var value: Double
    public init(date: Date, value: Double) { self.date = date; self.value = value }
}

public enum CurvePhase: String, Sendable, Codable {
    case none, rising, peak, declining

    public var label: String {
        switch self {
        case .none: return "효과 없음"
        case .rising: return "상승 중"
        case .peak: return "피크"
        case .declining: return "감소 중"
        }
    }
}

/// 순수 계산 함수 모음. 상태 없음.
public enum PK {
    /// OROS 균등 방출을 근사하는 볼루스 간격 (시간)
    public static let orosBolusStepHours = 0.1

    /// 베이트만 식. tHours: 복용 후 시간, doseMg: 흡수되는 활성 용량(mg).
    /// 반환: ng/mL
    public static func bateman(tHours t: Double, doseMg: Double, params: PKParams, ka: Double, weightKg: Double) -> Double {
        guard t > 0, doseMg > 0 else { return 0 }
        let ke = params.ke
        let vd = params.vdLPerKg * weightKg
        let f = params.bioavailability
        let mgPerL: Double
        if abs(ka - ke) < 1e-9 {
            mgPerL = f * doseMg * ke * t * exp(-ke * t) / vd
        } else {
            mgPerL = f * doseMg * ka / (vd * (ka - ke)) * (exp(-ke * t) - exp(-ka * t))
        }
        return mgPerL * 1000.0 // mg/L = µg/mL → ng/mL
    }

    public struct Bolus: Hashable, Sendable {
        public var offsetHours: Double
        public var mg: Double
        public var ka: Double
    }

    /// 한 번의 복용을 볼루스 목록으로 분해.
    public static func boluses(for dose: DoseEvent, drug: DrugDefinition, settings: ModelSettings) -> [Bolus] {
        let active = dose.mg * drug.activeFraction
        var ka = drug.params.ka
        if dose.withFood, let factor = drug.foodKaFactor { ka *= factor }
        switch drug.release {
        case .immediate:
            return [Bolus(offsetHours: 0, mg: active, ka: ka)]
        case .oros(let immediateFraction):
            var result = [Bolus(offsetHours: 0, mg: active * immediateFraction, ka: ka)]
            let duration = max(settings.orosReleaseHours, orosBolusStepHours)
            let n = max(1, Int((duration / orosBolusStepHours).rounded()))
            let step = duration / Double(n)
            let each = active * (1 - immediateFraction) / Double(n)
            for i in 0..<n {
                // 각 구간의 가운데에서 방출
                result.append(Bolus(offsetHours: (Double(i) + 0.5) * step, mg: each, ka: ka))
            }
            return result
        }
    }

    /// 한 번의 복용이 시각 date에 만드는 농도 (ng/mL).
    public static func concentration(of dose: DoseEvent, at date: Date, settings: ModelSettings) -> Double {
        guard let drug = dose.drug else { return 0 }
        let t = date.timeIntervalSince(dose.time) / 3600.0
        guard t > 0 else { return 0 }
        var sum = 0.0
        for b in boluses(for: dose, drug: drug, settings: settings) {
            sum += bateman(tHours: t - b.offsetHours, doseMg: b.mg, params: drug.params, ka: b.ka, weightKg: settings.weightKg)
        }
        return sum
    }

    /// 카테고리의 모든 복용을 중첩한 농도 (ng/mL).
    public static func concentration(category: DrugCategory, doses: [DoseEvent], at date: Date, settings: ModelSettings) -> Double {
        var sum = 0.0
        for d in doses where d.drug?.category == category {
            sum += concentration(of: d, at: date, settings: settings)
        }
        return sum
    }

    /// 일정 간격 곡선 (ng/mL).
    public static func series(category: DrugCategory, doses: [DoseEvent], from: Date, to: Date,
                              stepMinutes: Double = 5, settings: ModelSettings) -> [CurvePoint] {
        let relevant = doses.filter { $0.drug?.category == category }
        guard to > from else { return [] }
        let step = stepMinutes * 60
        var points: [CurvePoint] = []
        var t = from
        while t <= to {
            points.append(CurvePoint(date: t, value: concentration(category: category, doses: relevant, at: t, settings: settings)))
            t = t.addingTimeInterval(step)
        }
        return points
    }

    public static func peak(of series: [CurvePoint]) -> CurvePoint? {
        series.max { $0.value < $1.value }
    }

    /// 한 번의 복용 후 피크까지 걸리는 시간(시간). 수치 탐색, 1분 해상도.
    public static func timeToPeakHours(dose: DoseEvent, settings: ModelSettings, horizonHours: Double = 24) -> Double {
        var best = 0.0, bestT = 0.0
        var m = 1.0
        while m <= horizonHours * 60 {
            let v = concentration(of: dose, at: dose.time.addingTimeInterval(m * 60), settings: settings)
            if v > best { best = v; bestT = m / 60 }
            m += 1
        }
        return bestT
    }

    /// after 이후 처음으로 threshold 위에서 아래로 내려가는 시각 (1분 정밀도).
    /// after 시점에 이미 아래이고 이후로도 넘지 않으면 nil.
    public static func crossingBelow(threshold: Double, category: DrugCategory, doses: [DoseEvent],
                                     after: Date, horizonHours: Double = 48, settings: ModelSettings) -> Date? {
        let relevant = doses.filter { $0.drug?.category == category }
        let coarse = 5.0 * 60
        var prevT = after
        var prevV = concentration(category: category, doses: relevant, at: prevT, settings: settings)
        let end = after.addingTimeInterval(horizonHours * 3600)
        var t = after.addingTimeInterval(coarse)
        while t <= end {
            let v = concentration(category: category, doses: relevant, at: t, settings: settings)
            if prevV >= threshold && v < threshold {
                // 이분 탐색으로 정밀화
                var lo = prevT, hi = t
                while hi.timeIntervalSince(lo) > 30 {
                    let mid = lo.addingTimeInterval(hi.timeIntervalSince(lo) / 2)
                    if concentration(category: category, doses: relevant, at: mid, settings: settings) >= threshold {
                        lo = mid
                    } else {
                        hi = mid
                    }
                }
                return hi
            }
            prevT = t
            prevV = v
            t = t.addingTimeInterval(coarse)
        }
        return nil
    }

    // MARK: - 하루 최고치 대비 %

    /// 복용일 기준 하루의 시작 (오전 4시 경계).
    public static func doseDayStart(_ date: Date, calendar: Calendar = .current) -> Date {
        let shifted = date.addingTimeInterval(-4 * 3600)
        return calendar.startOfDay(for: shifted).addingTimeInterval(4 * 3600)
    }

    /// 그 날(dayStart부터 24시간) 복용분을 기준으로 한 최고 농도. 36시간 창에서 탐색.
    public static func dailyPeak(category: DrugCategory, doses: [DoseEvent], dayStart: Date, settings: ModelSettings) -> Double {
        let relevant = doses.filter { $0.drug?.category == category }
        let dayEnd = dayStart.addingTimeInterval(24 * 3600)
        guard relevant.contains(where: { $0.time >= dayStart && $0.time < dayEnd }) else { return 0 }
        let s = series(category: category, doses: relevant, from: dayStart, to: dayStart.addingTimeInterval(36 * 3600),
                       stepMinutes: 5, settings: settings)
        return peak(of: s)?.value ?? 0
    }

    /// 농도 곡선을 그 시점의 가장 최근 복용일 최고치 대비 %로 변환.
    public static func percentOfDailyPeak(_ series: [CurvePoint], category: DrugCategory, doses: [DoseEvent],
                                          settings: ModelSettings, calendar: Calendar = .current) -> [CurvePoint] {
        let relevant = doses.filter { $0.drug?.category == category }.sorted { $0.time < $1.time }
        var cache: [Date: Double] = [:]
        return series.map { p in
            guard let last = relevant.last(where: { $0.time <= p.date }) else {
                return CurvePoint(date: p.date, value: 0)
            }
            let day = doseDayStart(last.time, calendar: calendar)
            let ref: Double
            if let c = cache[day] { ref = c } else {
                ref = dailyPeak(category: category, doses: relevant, dayStart: day, settings: settings)
                cache[day] = ref
            }
            guard ref > 0 else { return CurvePoint(date: p.date, value: 0) }
            return CurvePoint(date: p.date, value: min(100, p.value / ref * 100))
        }
    }

    // MARK: - 구간, 상태

    /// value >= threshold 인 구간들.
    public static func intervals(above threshold: Double, in series: [CurvePoint]) -> [ClosedRange<Date>] {
        var result: [ClosedRange<Date>] = []
        var start: Date?
        var last: Date?
        for p in series {
            if p.value >= threshold {
                if start == nil { start = p.date }
                last = p.date
            } else if let s = start, let l = last {
                result.append(s...l)
                start = nil
            }
        }
        if let s = start, let l = last { result.append(s...l) }
        return result
    }

    /// 일정 간격 배열에서 date의 값을 선형 보간.
    public static func interpolate(_ series: [CurvePoint], at date: Date) -> Double {
        guard let first = series.first, let last = series.last else { return 0 }
        if date <= first.date { return first.value }
        if date >= last.date { return last.value }
        var lo = 0, hi = series.count - 1
        while hi - lo > 1 {
            let mid = (lo + hi) / 2
            if series[mid].date <= date { lo = mid } else { hi = mid }
        }
        let a = series[lo], b = series[hi]
        let span = b.date.timeIntervalSince(a.date)
        guard span > 0 else { return a.value }
        let f = date.timeIntervalSince(a.date) / span
        return a.value + (b.value - a.value) * f
    }

    /// % 곡선 기준 현재 상태.
    public static func phase(percentSeries: [CurvePoint], at date: Date) -> CurvePhase {
        let now = interpolate(percentSeries, at: date)
        if now < 3 { return .none }
        if now >= 90 { return .peak }
        let later = interpolate(percentSeries, at: date.addingTimeInterval(10 * 60))
        return later > now ? .rising : .declining
    }
}
