/**
 * AI Universal Test Generator - Settings v4.0 (Dual Mode)
 */

const CONFIG = {
    providers: {
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            models: {
                architect: 'xiaomi/mimo-v2-flash:free',
                generator: 'xiaomi/mimo-v2-flash:free' // Или liquid/lfm-40b
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
                architect: 'gemini-2.0-flash-exp',
                generator: 'gemini-2.0-flash-exp'
            }
        }
    },
    generation: { temperature: 0.7 },
    limits: { minQuestions: 5, maxQuestions: 20 }
};

// СХЕМЫ (JSON Structure)
const SCHEMAS = {
    // --- PSY MODE ---
    psy_blueprint: {
        testType: "categorical",
        outcomes: [
            { id: "o1", name: "Result Name", description: "Description" }
        ]
    },
    psy_questions: {
        questions: [
            {
                text: "Question text?",
                mapping: [{ outcomeId: "o1", weight: 1 }]
            }
        ]
    },

    // --- QUIZ MODE ---
    quiz_blueprint: {
        testType: "quiz",
        outcomes: [
            { 
                minScore: 0, 
                maxScore: 3, 
                name: "Новичок", 
                description: "Ты только начал свой путь..." 
            }
        ]
    },
    quiz_questions: {
        questions: [
            {
                text: "Вопрос викторины?",
                options: ["Ответ А", "Ответ Б", "Ответ В", "Ответ Г"],
                correctIndex: 0 // 0 = Ответ А
            }
        ]
    }
};

// ПРОМПТЫ (Заглушки для следующего этапа)
const PROMPTS = {
    openrouter: {
        architect_psy: `Ты Архитектор Психологических тестов. Ответь JSON.`,
        generator_psy: `Ты Генератор Вопросов для теста личности. Ответь JSON.`,
        
        architect_quiz: `Ты Архитектор Викторин. Создай уровни оценки знаний (Outcomes) на основе количества правильных ответов. Ответь JSON.`,
        generator_quiz: `Ты Автор Викторин. Создай вопросы с вариантами ответов и укажи индекс правильного (0-N). Ответь JSON.`
    },
    gemini: {
        architect_psy: `Ты Архитектор Психологических тестов.`,
        generator_psy: `Ты Генератор Вопросов для теста личности.`,
        
        architect_quiz: `Ты Архитектор Викторин. Создай уровни оценки знаний.`,
        generator_quiz: `Ты Автор Викторин. Создай вопросы с вариантами ответов.`
    }
};
