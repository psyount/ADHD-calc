// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PKCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PKCore", targets: ["PKCore"])
    ],
    targets: [
        .target(name: "PKCore"),
        .testTarget(name: "PKCoreTests", dependencies: ["PKCore"])
    ]
)
