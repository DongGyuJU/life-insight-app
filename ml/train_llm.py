import torch
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# 1. 모델 및 토크나이저 로드 (모바일 최적화 1.5B 사이즈)
max_seq_length = 2048
model_name = "unsloth/Qwen2.5-1.5B-Instruct-bnb-4bit"

print("🔄 1. 베이스 모델 로드 중...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = model_name,
    max_seq_length = max_seq_length,
    dtype = None,
    load_in_4bit = True, # 4bit 양자화로 VRAM 다이어트
)

# 2. LoRA (파인튜닝 어댑터) 설정
print("🧠 2. 파인튜닝 어댑터(LoRA) 부착 중...")
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # 숫자가 클수록 똑똑해지지만 메모리를 더 먹습니다 (16이 황금비율)
    target_modules sudo chown kimlab:kimlab ~/lifelog-ml-project/llm-model/train_llm.py= ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj",],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 3. 데이터셋 로드 및 ChatML 포맷팅
print("📂 3. 데이터셋 로드 및 포맷팅 중...")
tokenizer = get_chat_template(
    tokenizer,
    chat_template = "qwen-2.5", # Qwen의 대화 형식(Chat Template) 적용
)

def formatting_prompts_func(examples):
    convos = examples["messages"]
    texts = [tokenizer.apply_chat_template(convo, tokenize = False, add_generation_prompt = False) for convo in convos]
    return { "text" : texts, }

# 우리가 만든 54개의 데이터를 불러와서 포맷팅합니다.
dataset = load_dataset("json", data_files="final_finetune.jsonl", split="train")
dataset = dataset.map(formatting_prompts_func, batched = True,)

# 4. 트레이너(Trainer) 세팅 및 학습 시작
print("🔥 4. 본격적인 파인튜닝 학습 시작!")
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # 데이터가 54개이므로 60 step 정도면 충분히 규칙을 깨닫습니다.
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 10,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer_stats = trainer.train()

# 5. 아이패드용으로 최종 추출 (GGUF 포맷)
print("📦 5. 모바일 탑재용 GGUF 파일 추출 중...")
# Q4_K_M은 모바일 기기에서 속도와 성능의 밸런스가 가장 좋은 양자화 규격입니다.
model.save_pretrained_gguf("model_gguf", tokenizer, quantization_method = "q4_k_m")

print("✅ 모든 과정 완료! 'model_gguf' 폴더 안에 아이패드용 모델이 생성되었습니다.")