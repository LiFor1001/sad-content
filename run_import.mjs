import fs from 'fs';
import path from 'path';

const CONTENT_DIR = './content';
const DATA_DIR = './data';

function toCsvValue(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function extractNumber(str) {
  const match = String(str).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function generateCSV() {
  console.log('=== ФИНАЛЬНАЯ СБОРКА ВСЕХ CSV-ФАЙЛОВ ===\n');

  const jsonFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort((a, b) => {
    return (extractNumber(a) || 0) - (extractNumber(b) || 0);
  });

  const mdFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));

  console.log(`Найдено файлов с заданиями: ${jsonFiles.length}`);
  console.log(`Найдено конспектов: ${mdFiles.length}`);

  const lessonRows = [
    ['moduleId', 'section', 'topicNumber', 'title', 'summary', 'readingTimeMinutes', 'contentMarkdown', 'isAvailable']
  ];

  const quizRows = [
    ['moduleId', 'questionNumber', 'tour', 'type', 'question', 'options', 'correctAnswers', 'acceptedAnswers', 'matchingPairs', 'explanation']
  ];

  const writtenRows = [
    ['moduleId', 'taskNumber', 'type', 'title', 'sourceLabel', 'maxScore', 'stimulusText', 'prompts', 'limits', 'rubric', 'modelAnswer']
  ];

  for (const jf of jsonFiles) {
    const jsonRaw = fs.readFileSync(path.join(DATA_DIR, jf), 'utf-8');
    let taskData = {};
    try {
      taskData = JSON.parse(jsonRaw);
    } catch (e) {
      console.warn(`Ошибка чтения ${jf}`);
      continue;
    }

    const meta = taskData.unit_meta || {};
    const topicNum = meta.topic_number || extractNumber(jf) || 1;
    const moduleId = meta.module_id || `theme_${topicNum}`;
    const section = meta.section || 'Обществознание';
    const title = meta.topic_name || `Тема №${topicNum}`;

    // 1. Конспект
    const targetMd = mdFiles.find(mf => extractNumber(mf) === topicNum);
    let mdRaw = `# ${title}`;
    let summary = `Модуль: ${title}`;

    if (targetMd) {
      mdRaw = fs.readFileSync(path.join(CONTENT_DIR, targetMd), 'utf-8');
      const introMatch = mdRaw.match(/###\s*2\.\s*Введение[^\n]*\n+([\s\S]*?)(?=###\s*3|$)/i);
      if (introMatch) {
        summary = introMatch[1].replace(/[*_#]/g, '').trim().slice(0, 250) + '...';
      }
    }

    lessonRows.push([
      moduleId,
      section,
      topicNum,
      title,
      summary,
      20,
      mdRaw,
      true
    ]);

    // 2. Тесты (practice_quiz_30)
    const tests = taskData.practice_quiz_30 || [];
    tests.forEach((t, idx) => {
      quizRows.push([
        moduleId,
        t.id || t.question_number || (idx + 1),
        t.tour || (idx < 15 ? 1 : 2),
        t.type || 'multiple_choice',
        t.question || t.prompt || '',
        t.options || [],
        Array.isArray(t.correct_answers) ? t.correct_answers : (Array.isArray(t.correct_answer) ? t.correct_answer : [t.correct_answer ?? 0]),
        t.accepted_answers || [],
        t.matching_pairs || t.pairs || [],
        t.explanation || t.detailed_explanation || ''
      ]);
    });

    // 3. Письменные задания (written_assignments_3)
    const written = taskData.written_assignments_3 || [];
    written.forEach((wt, idx) => {
      let maxScore = wt.max_score || wt.score || 5;
      if (!wt.max_score && wt.type?.includes('12')) maxScore = 12;
      if (!wt.max_score && wt.type?.includes('10')) maxScore = 10;

      writtenRows.push([
        moduleId,
        wt.task_number || (idx + 1),
        wt.type || `task_${idx + 1}`,
        wt.title || wt.name || `Кейс №${idx + 1}`,
        wt.source_label || wt.source || 'Первоисточник олимпиады ВШЭ',
        maxScore,
        wt.stimulus_text || wt.source_text || wt.text || '',
        wt.prompt || wt.prompts || wt.task_text || '',
        wt.limits || (maxScore === 10 ? 'Текст строго не более 4 предложений' : ''),
        typeof wt.criteria_rubric === 'object' ? JSON.stringify(wt.criteria_rubric) : (wt.criteria_rubric || wt.rubric || ''),
        wt.model_answer || wt.sample_answer || ''
      ]);
    });
  }

  fs.writeFileSync('LessonModule.csv', lessonRows.map(r => r.map(toCsvValue).join(',')).join('\n'), 'utf-8');
  console.log(`-> Создан LessonModule.csv (${lessonRows.length - 1} строк)`);

  fs.writeFileSync('QuizQuestion.csv', quizRows.map(r => r.map(toCsvValue).join(',')).join('\n'), 'utf-8');
  console.log(`-> Создан QuizQuestion.csv (${quizRows.length - 1} строк)`);

  fs.writeFileSync('WrittenTask.csv', writtenRows.map(r => r.map(toCsvValue).join(',')).join('\n'), 'utf-8');
  console.log(`-> Создан WrittenTask.csv (${writtenRows.length - 1} строк)`);

  console.log('\n=========================================');
  console.log('ВСЕ ТРИ CSV-ФАЙЛА ПОЛНОСТЬЮ ГОТОВЫ К ЗАГРУЗКЕ!');
  console.log('=========================================');
}

generateCSV();