import XCTest
@testable import PKCore

final class PKCoreTests: XCTestCase {
    let t0 = Date(timeIntervalSince1970: 1_800_000_000)
    let settings = ModelSettings.standard

    func testCaffeinePeakTimeMatchesAnalytic() {
        // 단일 베이트만: tmax = ln(ka/ke)/(ka-ke)
        let p = PKParamSet.caffeine
        let expected = log(p.ka / p.ke) / (p.ka - p.ke)
        let dose = DoseEvent(drugID: "caffeine", mg: 100, time: t0)
        let found = PK.timeToPeakHours(dose: dose, settings: settings)
        XCTAssertEqual(found, expected, accuracy: 1.0 / 60.0 + 1e-9)
    }

    func testFoodSlowsCaffeinePeak() {
        let fasted = PK.timeToPeakHours(dose: DoseEvent(drugID: "caffeine", mg: 100, time: t0), settings: settings)
        let fed = PK.timeToPeakHours(dose: DoseEvent(drugID: "caffeine", mg: 100, time: t0, withFood: true), settings: settings)
        XCTAssertGreaterThan(fed, fasted)
    }

    func testConcertaPeaksAroundSevenHours() {
        let dose = DoseEvent(drugID: "concerta", mg: 18, time: t0)
        let tmax = PK.timeToPeakHours(dose: dose, settings: settings)
        XCTAssertEqual(tmax, 7.0, accuracy: 0.6)
    }

    func testConcertaIgnoresFood() {
        let a = PK.concentration(of: DoseEvent(drugID: "concerta", mg: 36, time: t0), at: t0.addingTimeInterval(3 * 3600), settings: settings)
        let b = PK.concentration(of: DoseEvent(drugID: "concerta", mg: 36, time: t0, withFood: true), at: t0.addingTimeInterval(3 * 3600), settings: settings)
        XCTAssertEqual(a, b, accuracy: 1e-12)
    }

    func testCaffeineMagnitude() {
        // 100mg, 70kg: 최고 약 1.8 µg/mL 근처
        let dose = DoseEvent(drugID: "caffeine", mg: 100, time: t0)
        let tmax = PK.timeToPeakHours(dose: dose, settings: settings)
        let c = PK.concentration(of: dose, at: t0.addingTimeInterval(tmax * 3600), settings: settings)
        XCTAssertGreaterThan(c, 1500)
        XCTAssertLessThan(c, 2000)
    }

    func testSuperposition() {
        let a = DoseEvent(drugID: "caffeine", mg: 100, time: t0)
        let b = DoseEvent(drugID: "caffeine", mg: 80, time: t0.addingTimeInterval(3 * 3600), withFood: true)
        let c = DoseEvent(drugID: "concerta", mg: 18, time: t0)
        for h in [1.0, 4.0, 9.5] {
            let t = t0.addingTimeInterval(h * 3600)
            let sum = PK.concentration(category: .caffeine, doses: [a, b, c], at: t, settings: settings)
            let manual = PK.concentration(of: a, at: t, settings: settings) + PK.concentration(of: b, at: t, settings: settings)
            XCTAssertEqual(sum, manual, accuracy: 1e-9)
        }
    }

    func testNoConcentrationBeforeDose() {
        let dose = DoseEvent(drugID: "caffeine", mg: 100, time: t0)
        XCTAssertEqual(PK.concentration(of: dose, at: t0.addingTimeInterval(-60), settings: settings), 0)
        XCTAssertEqual(PK.concentration(of: dose, at: t0, settings: settings), 0)
    }

    func testThresholdCrossing() {
        let dose = DoseEvent(drugID: "caffeine", mg: 200, time: t0)
        guard let cross = PK.crossingBelow(threshold: 1000, category: .caffeine, doses: [dose], after: t0.addingTimeInterval(3600), settings: settings) else {
            return XCTFail("교차 시각 없음")
        }
        let before = PK.concentration(of: dose, at: cross.addingTimeInterval(-90), settings: settings)
        let after = PK.concentration(of: dose, at: cross.addingTimeInterval(30), settings: settings)
        XCTAssertGreaterThanOrEqual(before, 1000)
        XCTAssertLessThan(after, 1000)
        // 다른 날 두 번째 복용은 교차를 늦춘다
        let second = DoseEvent(drugID: "caffeine", mg: 100, time: t0.addingTimeInterval(4 * 3600))
        let later = PK.crossingBelow(threshold: 1000, category: .caffeine, doses: [dose, second], after: t0.addingTimeInterval(3600), settings: settings)
        XCTAssertNotNil(later)
        XCTAssertGreaterThan(later!, cross)
    }

    func testNoCrossingWhenAlwaysBelow() {
        let dose = DoseEvent(drugID: "caffeine", mg: 30, time: t0)
        XCTAssertNil(PK.crossingBelow(threshold: 1000, category: .caffeine, doses: [dose], after: t0, settings: settings))
    }

    func testPercentOfDailyPeakMaxIs100() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let dose = DoseEvent(drugID: "concerta", mg: 36, time: t0)
        let s = PK.series(category: .methylphenidate, doses: [dose], from: t0, to: t0.addingTimeInterval(20 * 3600), settings: settings)
        let pct = PK.percentOfDailyPeak(s, category: .methylphenidate, doses: [dose], settings: settings, calendar: cal)
        let m = pct.map(\.value).max() ?? 0
        XCTAssertEqual(m, 100, accuracy: 0.5)
        XCTAssertFalse(PK.intervals(above: 50, in: pct).isEmpty)
    }

    func testShrinkage() {
        XCTAssertEqual(Calibration.shrink(defaultValue: 50, personal: nil, days: 0), 50)
        XCTAssertEqual(Calibration.shrink(defaultValue: 50, personal: 70, days: 5), 60, accuracy: 1e-9)
        XCTAssertEqual(Calibration.median([3, 1, 2, 10]) ?? 0, 2.5, accuracy: 1e-9)
    }
}
