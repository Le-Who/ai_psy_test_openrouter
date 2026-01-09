/**
 * AI Universal Test Generator - App Settings
 * ==========================================
 * Конфигурация, Промпты и JSON-Схемы
 * v2.1 (Hybrid Prompts: High Quality + Soft Weights Logic)
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
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
            models: {
                architect: 'gemini-2.5-flash',
                generator: 'gemini-2.5-flash'
            }
        }
    },

    // ===== ПАРАМЕТРЫ =====
    generation: {
        temperature: 0.7,
        maxTokens: 4000,
        timeoutMs: 60000
    },

    limits: {
        minQuestions: 5,
        maxQuestions: 20,
        minOutcomes: 2,
        maxOutcomes: 12
    },

    ui: {
        answerDelayMs: 250,
        debugMode: true,
        resultsAnimationDelay: 600
    }
};

// ===== СИСТЕМНЫЕ ПРОМПТЫ (ОБОГАЩЕННЫЕ) =====
const PROMPTS = {
    // Архитектор: Взяли структуру из старого + четкость из нового
    architect: `Ты — Главный Архитектор Психометрических Систем.
Твоя задача — проанализировать запрос пользователя и спроектировать идеальную структуру теста.

ТИПЫ ТЕСТОВ:
1. **categorical** (Категориальный/Типология)
   - Вопросы вида: "Кто ты из [Франшизы]?", "Какой ты [Предмет]?", "Твой архетип".
   - Цель: Классифицировать пользователя как один из типажей.
   - Результат: 4-10 уникальных персонажей/типов с яркими описаниями.

2. **dimensional** (Размерный/Шкалы)
   - Вопросы вида: "Уровень твоей [Черты]", "Насколько ты [Качество]".
   - Цель: Измерить выраженность характеристик.
   - Результат: 1-5 независимых шкал (например: "Стресс", "Эмпатия").

ТРЕБОВАНИЯ К КОНТЕНТУ:
- Язык: Строго РУССКИЙ.
- Описания результатов: Емкие, интересные, "попадающие в точку" (2-3 предложения).
- Если тема развлекательная (мемы, игры, кино) -> выбирай categorical.
- Если тема серьезная (психология, навыки) -> выбирай dimensional.`,

    // Генератор: Взяли стиль вопросов из старого + логику Soft Weights из нового
    generator: `Ты — Профессиональный Автор Тестов и Психометрист.
Твоя задача — создать глубокие вопросы, которые точно распределяют людей по результатам.

ПРАВИЛА ДЛЯ ВОПРОСОВ:
1. **Язык**: Строго РУССКИЙ.
2. **Формат**: Утверждения от первого лица ("Я люблю...", "Мне свойственно...", "В трудной ситуации я...").
3. **Стиль**: Естественный, живой, подходящий под тему (серьезный для психологии, веселый для игр).
4. **Длина**: 10-20 слов. Одна мысль на вопрос.

!!! КРИТИЧЕСКИ ВАЖНО ПРО ВЕСА (MAPPING) !!!
Чтобы тест работал точно, следуй логике "Soft Weights" (Мягких Весов):

**Для CATEGORICAL (Персонажи):**
- ИЗБЕГАЙ бинарности (где вопрос дает балл только одному персонажу).
- Один вопрос должен влиять на НЕСКОЛЬКО персонажей с разной силой.
- Пример: Вопрос "Я всегда стремлюсь к лидерству".
  * Персонаж А (Лидер): weight +1.0 (Сильное совпадение)
  * Персонаж Б (Амбициозный): weight +0.5 (Частичное совпадение)
  * Персонаж В (Скромный): weight -1.0 (Противоречие)
  * Персонаж Г (Лентяй): weight -0.5 (Небольшое противоречие)

**Для DIMENSIONAL (Шкалы):**
- Используй прямые (+1.0) и обратные (-1.0) вопросы для баланса.
- Используй дробные веса (0.5) для вопросов, косвенно связанных с чертой.

ЦЕЛЬ: Максимально точный и нюансированный профиль пользователя.`
};

// ===== JSON SCHEMAS =====
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

console.log("✅ App Settings Loaded (Hybrid Prompts)");
