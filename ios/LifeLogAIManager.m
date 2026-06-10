//
//  LifeLogAIManger.m
//  LifeInsight
//
//  Created by 주동규 on 5/27/26.
//

#import <React/RCTBridgeModule.h>

// Swift에서 만든 'LifeLogAIManager' 클래스를 React Native 모듈로 등록합니다.
@interface RCT_EXTERN_MODULE(LifeLogAIManager, NSObject)

// Swift에 있는 'trainModelOnDevice' 함수를 JavaScript에서 쓸 수 있게 열어줍니다.
RCT_EXTERN_METHOD(trainModelOnDevice)

// CoreML 학습은 무겁기 때문에, 메인(UI) 스레드가 아닌 백그라운드 스레드에서 돌도록 설정합니다.
+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
