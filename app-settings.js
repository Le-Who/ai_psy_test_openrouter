/**
 * AI Universal Test Generator - Configuration
 * ============================================
 * Настройки с поддержкой мульти-провайдеров (OpenRouter + Gemini)
 */

const CONFIG = {
    // ===== ПРОВАЙДЕРЫ И МОДЕЛИ =====
    providers: {
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            models: {
                architect: 'xiaomi/mimo-v2-flash:free',
                generator: 'xiaomi/mimo-v2-flash:free'
            },
            headers: (key) => ({
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'AI Universal Test'
            })
        },
        gemini: {
            // Endpoint формируется динамически, здесь база
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
            models: {
                // Используем Flash модели для скорости и бесплатного тира
                architect: 'gemini-2.5-flash', 
                generator: 'gemini-2.5-flash'
            }
        }
    },

    // ===== ПАРАМЕТРЫ =====
    generation: {
        temperature: 0.7,
        maxTokens: 4000,
        timeoutMs: 45000
    },

    // ===== ОГРАНИЧЕНИЯ =====
    limits: {
        minQuestions: 5,
        maxQuestions: 20,
        minOutcomes: 2,
        maxOutcomes: 12
    },

    // ===== UI =====
    ui: {
        answerDelayMs: 250,
        debugMode: true,
        resultsAnimationDelay: 600
    }
};

// ===== ПРОМПТЫ (Без изменений) =====
const PROMPTS = {
    // Этап 1: Архитектор (определяет структуру теста)
    architect: `Ты — Архитектор Психометрических Систем.

Твоя задача — проанализировать запрос пользователя и спроектировать идеальную структуру теста.

ТИПЫ ТЕСТОВ:
1. **categorical** (Категориальный) — для вопросов вида:
   - "Кто ты из [Франшизы]?"
   - "Какой у тебя [Архетип]?"
   - "Твой тип личности по [Системе]"
   → Результат: определение одного победителя (персонажа/типа) из списка.

2. **dimensional** (Размерный) — для вопросов вида:
   - "Уровень твоей [Черты]"
   - "Оценка [Качества]"
   - "Насколько ты [Прилагательное]"
   → Результат: баллы по одной или нескольким независимым шкалам.

ТРЕБОВАНИЯ К OUTCOMES (Результатам):
- Для categorical: создай 4-10 персонажей/типов с уникальными характеристиками.
- Для dimensional: создай 1-5 психологических шкал (измерений).
- Имена и описания строго на РУССКОМ языке.
- Описания должны быть краткими, но емкими (2-3 предложения).

ВАЖНО:
- Если тема неоднозначна — выбирай более интересный, развлекательный вариант (обычно categorical).
- Избегай банальных формулировок.`,

    // Этап 2: Генератор (создает вопросы)
    generator: `Ты — Профессиональный Автор Тестов.

Твоя задача — создать интересные вопросы, которые распределяют людей по утвержденным результатам.

ПРАВИЛА ДЛЯ ВОПРОСОВ:
1. **Язык**: Строго РУССКИЙ.
2. **Формат**: Утверждения от первого лица ("Я люблю...", "Мне нравится..."), с которыми пользователь соглашается или нет.
3. **Длина**: 10-20 слов.
4. **Стиль**: Естественный, разговорный, подходящий теме.

ПРАВИЛА ДЛЯ MAPPING (Связь вопросов с результатами):

**Для CATEGORICAL (Персонажи/Типы):**
- Каждый вопрос должен быть индикатором одной или нескольких черт.
- Вес +1 (или больше): Ответ "Согласен" приближает к этому персонажу.
- Вес -1 (или меньше): Ответ "Согласен" отдаляет от этого персонажа (противоречит ему).
- Указывай mapping только для тех персонажей, на которых этот вопрос реально влияет.

**Для DIMENSIONAL (Шкалы):**
- Вес +1: Прямая корреляция (ответ "Да" повышает балл шкалы).
- Вес -1: Обратная корреляция (ответ "Да" понижает балл шкалы).

ЦЕЛЬ: Максимально точно определить результат пользователя.`
};

// ===== СХЕМЫ JSON (OpenAI Format) =====
// Для Gemini они будут автоматически конвертированы в коде
const SCHEMAS = {
    blueprint: {
        "type": "json_schema",
        "json_schema": {
            "name": "test_blueprint",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "testType": { "type": "string", "enum": ["dimensional", "categorical"] },
                    "language": { "type": "string", "enum": ["ru"] },
                    "outcomes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": { "type": "string" },
                                "name": { "type": "string" },
                                "description": { "type": "string" }
                            },
                            "required": ["id", "name", "description"],
                            "additionalProperties": false
                        }
                    }
                },
                "required": ["testType", "language", "outcomes"],
                "additionalProperties": false
            }
        }
    },

    questions: {
        "type": "json_schema",
        "json_schema": {
            "name": "test_questions_pack",
            "strict": true,
            "schema": {
                "type": "object",
                "properties": {
                    "questions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": { "type": "string" },
                                "mapping": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "outcomeId": { "type": "string" },
                                            "weight": { "type": "number" }
                                        },
                                        "required": ["outcomeId", "weight"],
                                        "additionalProperties": false
                                    }
                                }
                            },
                            "required": ["text", "mapping"],
                            "additionalProperties": false
                        }
                    }
                },
                "required": ["questions"],
                "additionalProperties": false
            }
        }
    }
};

console.log("✅ Config loaded (Multi-provider support)");
