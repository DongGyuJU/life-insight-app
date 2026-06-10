import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import BackgroundTasks // [추가됨] 백그라운드 태스크 프레임워크

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "LifeInsight",
      in: window,
      launchOptions: launchOptions
    )

    // ==========================================
    // [추가됨] 1. 백그라운드 작업(ML 학습) 등록
    // ==========================================
    if #available(iOS 13.0, *) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.lifeinsight.mlupdate", using: nil) { task in
            // 식별자와 일치하는 작업이 깨어나면 handleMLUpdateTask 함수를 실행합니다.
            guard let processingTask = task as? BGProcessingTask else { return }
            self.handleMLUpdateTask(task: processingTask)
        }
    }

    return true
  }

  // ==========================================
  // [추가됨] 2. 앱이 백그라운드로 들어갈 때마다 작업 예약
  // ==========================================
  func applicationDidEnterBackground(_ application: UIApplication) {
      scheduleMLUpdateTask()
  }

  // ==========================================
  // [추가됨] 3. 실제 예약(Schedule) 로직
  // ==========================================
  func scheduleMLUpdateTask() {
      if #available(iOS 13.0, *) {
          let request = BGProcessingTaskRequest(identifier: "com.lifeinsight.mlupdate")
          
          // 배터리 보호를 위해 기기가 유휴 상태(충전 중 등)일 때만 실행
          request.requiresExternalPower = true
          request.requiresNetworkConnectivity = false
          
          do {
              try BGTaskScheduler.shared.submit(request)
              print("✅ 백그라운드 ML 학습이 예약되었습니다.")
          } catch {
              print("❌ 백그라운드 ML 학습 예약 실패: \(error)")
          }
      }
  }

  // ==========================================
  // [추가됨] 4. iOS가 작업을 깨웠을 때 실행될 메인 로직
  // ==========================================
  @available(iOS 13.0, *)
  func handleMLUpdateTask(task: BGProcessingTask) {
      // 다음번 백그라운드 진입을 위해 다시 예약
      scheduleMLUpdateTask()

      print("🚀 백그라운드 환경에서 CoreML 온디바이스 학습을 시작합니다.")

      // 우리가 만든 Swift 클래스 호출 (동일한 Swift 파일 내 프로젝트에 있으므로 바로 접근 가능)
      let aiManager = LifeLogAIManager()
      
      // iOS 시스템이 리소스 부족으로 작업을 강제 종료시킬 때의 처리
      task.expirationHandler = {
          print("⚠️ iOS에 의해 백그라운드 ML 학습이 중단되었습니다.")
      }

      // 온디바이스 학습 실행!
      aiManager.trainModelOnDevice()
      
      // 작업 완료 보고
      task.setTaskCompleted(success: true)
  }
}

// (기존 코드 유지)
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
