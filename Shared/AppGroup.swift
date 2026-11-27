import Foundation
import PKCore

/// 앱과 위젯이 함께 쓰는 App Group 저장소.
enum AppGroup {
    static let identifier = "group.com.focuslog.app"

    /// App Group 컨테이너. 재서명 과정에서 그룹이 빠지면 앱 자체 폴더로 대체.
    static var containerURL: URL {
        if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) {
            return url
        }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }

    static var snapshotURL: URL { containerURL.appendingPathComponent(WidgetSnapshot.fileName) }

    static func loadSnapshot() -> WidgetSnapshot? {
        guard let data = try? Data(contentsOf: snapshotURL) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }

    static func saveSnapshot(_ snapshot: WidgetSnapshot) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        guard let data = try? encoder.encode(snapshot) else { return }
        try? FileManager.default.createDirectory(at: containerURL, withIntermediateDirectories: true)
        try? data.write(to: snapshotURL, options: .atomic)
    }
}
