import SwiftUI
import PKCore

@main
struct FocusLogApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 12) {
                Text("약효 곡선")
                    .font(.largeTitle.bold())
                Text("1단계: 빌드 확인용 빈 화면")
                    .foregroundStyle(.secondary)
                Text("콘서타 기본 피크: 복용 후 \(String(format: "%.1f", PK.timeToPeakHours(dose: DoseEvent(drugID: "concerta", mg: 18, time: .now), settings: .standard)))시간")
                    .font(.footnote.monospaced())
            }
            .preferredColorScheme(.dark)
        }
    }
}
