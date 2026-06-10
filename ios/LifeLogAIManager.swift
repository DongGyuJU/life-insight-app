//
//  LifeLogAIManager.swift
//  LifeInsight
//
//  Created by 주동규 on 5/27/26.
//

import Foundation
import CoreML

@objc(LifeLogAIManager)
class LifeLogAIManager: NSObject {
    
    // 1. 컴파일된 모델의 기본 경로를 가져옵니다.
    private var baseModelURL: URL? {
        return Bundle.main.url(forResource: "LifeLogUpdatable", withExtension: "mlmodelc")
    }
    
    // 2. 업데이트된 모델을 저장할 앱 내부의 Document 경로를 설정합니다.
    private var updatedModelURL: URL {
        let documentDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documentDirectory.appendingPathComponent("LifeLogUpdated.mlmodelc")
    }
    
    // 3. 온디바이스 학습을 실행하는 메인 함수
  @objc
      func trainModelOnDevice() {
          // [수정됨] 강제 언래핑(!)을 제거하고 안전하게(Safe Unwrapping) 확인합니다.
          guard let validBaseURL = baseModelURL else {
              print("❌ 에러: 원본 모델 파일(LifeLogUpdatable.mlmodelc)을 앱 내부에서 찾을 수 없습니다.")
              print("👉 조치: Xcode에서 모델 파일의 'Target Membership'이 체크되어 있는지 확인하세요.")
              return
          }
          
          let targetURL = FileManager.default.fileExists(atPath: updatedModelURL.path) ? updatedModelURL : validBaseURL
          
          do {
              let trainingData = try prepareTrainingData()
            
            // 모델 설정 (Neural Engine과 CPU를 적절히 사용하도록 설정)
            let config = MLModelConfiguration()
            config.computeUnits = .all
          
            // MLUpdateTask 생성
            let updateTask = try MLUpdateTask(
                forModelAt: targetURL,
                trainingData: trainingData,
                configuration: config,
                progressHandlers: MLUpdateProgressHandlers(
                    forEvents: [.trainingBegin, .epochEnd],
                    progressHandler: { context in
                        // 에폭(Epoch)이 끝날 때마다 호출됨 (React Native로 진행률 전송 가능)
                        print("진행 중... 에폭: \(context.metrics[.epochIndex] ?? 0)")
                    },
                    completionHandler: { context in
                        // 학습 완료 처리
                        self.handleTrainingCompletion(context: context)
                    }
                )
            )
            
            // 백그라운드 스레드에서 학습 시작!
            updateTask.resume()
            print("🚀 온디바이스 학습 시작됨...")
            
        } catch {
            print("❌ 학습 준비 중 에러 발생: \(error)")
        }
    }
    
    // 4. 학습 완료 후 모델 덮어쓰기 저장
    private func handleTrainingCompletion(context: MLUpdateContext) {
        if context.task.error != nil {
            print("❌ 학습 실패: \(String(describing: context.task.error))")
            return
        }
        
        do {
            let updatedModel = context.model
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("temp_model.mlmodelc")
            
            // 새로 학습된 가중치를 임시 파일로 저장한 뒤, 기존 파일을 안전하게 교체(Replace)
            try updatedModel.write(to: tempURL)
            _ = try FileManager.default.replaceItemAt(updatedModelURL, withItemAt: tempURL)
            
            print("✅ 온디바이스 학습 성공! 유저의 패턴이 모델에 반영되었습니다.")
            
        } catch {
            print("❌ 모델 저장 실패: \(error)")
        }
    }

    // ==========================================
    // 5. [교정됨] 데이터 준비 함수 (클래스 내부로 진입)
    // ==========================================
    private func prepareTrainingData() throws -> MLBatchProvider {
        var featureProviders: [MLFeatureProvider] = []
        
        let userInputs = [
            // shape [1, 64] -> [64] 로 1D 강제 매칭
            "input_ids": try MLMultiArray(shape: [1, 64], dataType: .float32),
            "intent_probs_true": try MLMultiArray(shape: [1], dataType: .int32)
        ]
        
        let provider = try MLDictionaryFeatureProvider(dictionary: userInputs)
        
        featureProviders.append(provider)
        featureProviders.append(provider)
        
        return MLArrayBatchProvider(array: featureProviders)
    }
  
} // <--- LifeLogAIManager 클래스가 최종적으로 여기서 끝나야 합니다!
