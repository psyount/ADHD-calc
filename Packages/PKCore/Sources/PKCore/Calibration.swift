import Foundation

/// 개인 보정 계산. 모두 순수 함수.
public enum Calibration {
    /// 기본값을 몇 일치로 볼지 (축소 보정 강도)
    public static let priorWeightDays = 5.0

    public static func median(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let s = values.sorted()
        let n = s.count
        return n % 2 == 1 ? s[n / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
    }

    /// (기본값*5 + 내값*n) / (5+n)
    public static func shrink(defaultValue: Double, personal: Double?, days: Int) -> Double {
        guard let personal, days > 0 else { return defaultValue }
        let n = Double(days)
        return (defaultValue * priorWeightDays + personal * n) / (priorWeightDays + n)
    }

    public struct PVTSample: Hashable, Sendable {
        public var time: Date
        public var medianRTms: Double
        public init(time: Date, medianRTms: Double) { self.time = time; self.medianRTms = medianRTms }
    }

    /// 하루 안에서 PVT가 개인 기준보다 좋은(빠른) 검사들의 처음~끝 시각.
    public static func goodWindow(samples: [PVTSample], personalBaselineMs: Double) -> ClosedRange<Date>? {
        let good = samples.filter { $0.medianRTms < personalBaselineMs }.map(\.time).sorted()
        guard let first = good.first, let last = good.last, last > first else { return nil }
        return first...last
    }

    /// 효과 창의 시작/끝 시각에서 곡선 % 평균 = 그날의 효과 기준선.
    public static func dayThreshold(window: ClosedRange<Date>, percentSeries: [CurvePoint]) -> Double? {
        guard !percentSeries.isEmpty else { return nil }
        let a = PK.interpolate(percentSeries, at: window.lowerBound)
        let b = PK.interpolate(percentSeries, at: window.upperBound)
        let v = (a + b) / 2
        return v > 0 ? v : nil
    }

    /// PVT 결과 중앙값의 중앙값 = 개인 기준.
    public static func personalBaseline(_ samples: [PVTSample]) -> Double? {
        median(samples.map(\.medianRTms))
    }

    /// PVT 표준 분석: 반응시간 중앙값, 지연(500ms 이상) 횟수.
    public static func summarizePVT(reactionTimesMs: [Double], lapseThresholdMs: Double = 500) -> (median: Double, lapses: Int)? {
        guard let m = median(reactionTimesMs) else { return nil }
        return (m, reactionTimesMs.filter { $0 >= lapseThresholdMs }.count)
    }
}
