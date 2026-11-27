import Foundation

/// 1구획 약동학 매개변수.
public struct PKParams: Codable, Hashable, Sendable {
    /// 경구 생체이용률 F (0~1)
    public var bioavailability: Double
    /// 반감기 t½ (시간)
    public var halfLifeHours: Double
    /// kg당 분포용적 Vd (L/kg)
    public var vdLPerKg: Double
    /// 흡수속도상수 ka (1/시간)
    public var ka: Double

    public init(bioavailability: Double, halfLifeHours: Double, vdLPerKg: Double, ka: Double) {
        self.bioavailability = bioavailability
        self.halfLifeHours = halfLifeHours
        self.vdLPerKg = vdLPerKg
        self.ka = ka
    }

    /// 소실속도상수 ke = ln2 / t½
    public var ke: Double { log(2.0) / halfLifeHours }
}

/// 제형별 방출 방식.
public enum ReleaseProfile: Codable, Hashable, Sendable {
    /// 속방형: t=0에 전량.
    case immediate
    /// 삼투압 방출(OROS): immediateFraction은 t=0, 나머지는 방출 시간 동안 균등 방출.
    /// 방출 시간은 ModelSettings.orosReleaseHours (보정 가능).
    case oros(immediateFraction: Double)
}

/// 곡선을 그리는 단위(차트 하나 = 카테고리 하나).
public enum DrugCategory: String, Codable, CaseIterable, Sendable {
    case methylphenidate
    case caffeine

    public var displayName: String {
        switch self {
        case .methylphenidate: return "메틸페니데이트"
        case .caffeine: return "카페인"
        }
    }
}

public struct DosePreset: Hashable, Sendable, Identifiable {
    public var id: String { "\(name)-\(mg)" }
    public let name: String
    public let mg: Double
    public init(name: String, mg: Double) { self.name = name; self.mg = mg }
}

/// 약 정의. 새 약은 DrugCatalog.all에 하나 추가하면 된다.
public struct DrugDefinition: Hashable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let category: DrugCategory
    public let params: PKParams
    public let release: ReleaseProfile
    /// 활성 성분 비율 (라세미체 MPH는 0.5 = d-MPH만)
    public let activeFraction: Double
    /// 음식과 함께일 때 ka 배수. nil이면 음식 영향 없음.
    public let foodKaFactor: Double?
    /// 선택 가능한 용량 (mg)
    public let presets: [DosePreset]
    /// mg 직접 입력 허용
    public let allowsCustomDose: Bool

    public init(id: String, name: String, category: DrugCategory, params: PKParams,
                release: ReleaseProfile, activeFraction: Double, foodKaFactor: Double?,
                presets: [DosePreset], allowsCustomDose: Bool) {
        self.id = id
        self.name = name
        self.category = category
        self.params = params
        self.release = release
        self.activeFraction = activeFraction
        self.foodKaFactor = foodKaFactor
        self.presets = presets
        self.allowsCustomDose = allowsCustomDose
    }
}

public enum PKParamSet {
    /// d-메틸페니데이트 (FDA Focalin / Ritalin LA label)
    public static let dMPH = PKParams(bioavailability: 0.22, halfLifeHours: 3.0, vdLPerKg: 2.65, ka: 1.5)
    /// 카페인 (NCBI NBK223808)
    public static let caffeine = PKParams(bioavailability: 0.99, halfLifeHours: 5.0, vdLPerKg: 0.7, ka: 4.0)
}

public enum DrugCatalog {
    public static let concerta = DrugDefinition(
        id: "concerta",
        name: "콘서타",
        category: .methylphenidate,
        params: PKParamSet.dMPH,
        release: .oros(immediateFraction: 0.22),
        activeFraction: 0.5,
        foodKaFactor: nil,
        presets: [18, 27, 36, 54].map { DosePreset(name: "\(Int($0))mg", mg: $0) },
        allowsCustomDose: false
    )

    public static let caffeine = DrugDefinition(
        id: "caffeine",
        name: "카페인",
        category: .caffeine,
        params: PKParamSet.caffeine,
        release: .immediate,
        activeFraction: 1.0,
        foodKaFactor: 0.8,
        presets: [
            DosePreset(name: "몬스터", mg: 100),
            DosePreset(name: "아메리카노", mg: 150),
            DosePreset(name: "에스프레소 1샷", mg: 75),
            DosePreset(name: "레드불", mg: 80),
            DosePreset(name: "콜라", mg: 30)
        ],
        allowsCustomDose: true
    )

    public static let all: [DrugDefinition] = [concerta, caffeine]

    public static func drug(id: String) -> DrugDefinition? {
        all.first { $0.id == id }
    }
}
