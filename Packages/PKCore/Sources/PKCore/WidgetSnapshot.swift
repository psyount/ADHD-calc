import Foundation

/// 앱이 미리 계산해 App Group에 저장하고, 위젯·Live Activity가 읽기만 하는 데이터.
public struct WidgetSnapshot: Codable, Hashable, Sendable {
    public static let fileName = "widget-snapshot.json"
    public static let stepMinutes: Double = 5

    public var generatedAt: Date
    /// 배열 첫 점의 시각. 이후 stepMinutes 간격.
    public var start: Date
    /// 메틸페니데이트: 그날 최고치 대비 %
    public var mphPercent: [Double]
    /// 카페인: ng/mL
    public var caffeineNg: [Double]
    public var mphDrugLabel: String?
    public var mphDoseTimes: [Date]
    public var caffeineDoseTimes: [Date]
    public var mphThresholdPercent: Double
    public var caffeineThreshold: Double
    /// 효과 기준선 아래로 떨어지는 시각 (효과 종료 예상)
    public var mphEffectEnd: Date?
    /// 카페인이 수면 기준선 아래로 내려가는 시각
    public var caffeineSleepOK: Date?
    public var bedtime: Date?

    public init(generatedAt: Date, start: Date, mphPercent: [Double], caffeineNg: [Double], mphDrugLabel: String?,
                mphDoseTimes: [Date], caffeineDoseTimes: [Date], mphThresholdPercent: Double, caffeineThreshold: Double,
                mphEffectEnd: Date?, caffeineSleepOK: Date?, bedtime: Date?) {
        self.generatedAt = generatedAt
        self.start = start
        self.mphPercent = mphPercent
        self.caffeineNg = caffeineNg
        self.mphDrugLabel = mphDrugLabel
        self.mphDoseTimes = mphDoseTimes
        self.caffeineDoseTimes = caffeineDoseTimes
        self.mphThresholdPercent = mphThresholdPercent
        self.caffeineThreshold = caffeineThreshold
        self.mphEffectEnd = mphEffectEnd
        self.caffeineSleepOK = caffeineSleepOK
        self.bedtime = bedtime
    }

    public func points(_ values: [Double]) -> [CurvePoint] {
        values.enumerated().map { i, v in
            CurvePoint(date: start.addingTimeInterval(Double(i) * WidgetSnapshot.stepMinutes * 60), value: v)
        }
    }

    public var mphPoints: [CurvePoint] { points(mphPercent) }
    public var caffeinePoints: [CurvePoint] { points(caffeineNg) }

    public var lastMphDose: Date? { mphDoseTimes.max() }
    public var lastCaffeineDose: Date? { caffeineDoseTimes.max() }
}
