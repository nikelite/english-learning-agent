import React from 'react';
import { ReadingLesson } from '../types';
import { splitIntoSentences } from '../geminiService';

export interface ContextSentenceMatch {
  sentence: string;
  word: string;
  paragraphNum: number | null;
}

export const getContextSentence = (questionText: string, lesson?: ReadingLesson | null): ContextSentenceMatch | null => {
  if (!lesson || !lesson.paragraphs || lesson.paragraphs.length === 0) return null;

  // 1. Extract the target word/phrase inside single/double quotes or standard quotes
  const wordMatch = questionText.match(/['"“‘]([^'"“”‘’\s.]{2,})['"”’]/);
  if (!wordMatch) return null;
  const targetWord = wordMatch[1].trim();

  // 2. Extract paragraph number if present
  const paragraphMatch = questionText.match(/paragraph\s+(\d+)/i);
  const paragraphNum = paragraphMatch ? parseInt(paragraphMatch[1], 10) : null;

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(targetWord);
  if (targetClean.length < 2) return null;

  // Helper to match target word inside a sentence
  const findSentenceMatch = (sentences: string[]): string | null => {
    // Try exact word match first
    let match = sentences.find(s => {
      const regex = new RegExp(`\\b${targetWord}\\b`, 'i');
      return regex.test(s);
    });
    if (match) return match;

    // Try substring match
    match = sentences.find(s => s.toLowerCase().includes(targetWord.toLowerCase()));
    if (match) return match;

    // Try stem/prefix match for longer words
    if (targetWord.length >= 5) {
      const stem = targetWord.substring(0, targetWord.length - 2).toLowerCase();
      match = sentences.find(s => s.toLowerCase().includes(stem));
      if (match) return match;
    }

    return null;
  };

  let matchedSentence: string | null = null;
  let finalParagraphNum = paragraphNum;

  if (paragraphNum !== null && paragraphNum > 0 && paragraphNum <= lesson.paragraphs.length) {
    const p = lesson.paragraphs[paragraphNum - 1];
    const sentences = splitIntoSentences(p.englishText);
    matchedSentence = findSentenceMatch(sentences);
  }

  // If no paragraph specified or not found in specified paragraph, search the entire passage
  if (!matchedSentence) {
    for (let idx = 0; idx < lesson.paragraphs.length; idx++) {
      const p = lesson.paragraphs[idx];
      const sentences = splitIntoSentences(p.englishText);
      const matched = findSentenceMatch(sentences);
      if (matched) {
        matchedSentence = matched;
        finalParagraphNum = idx + 1;
        break;
      }
    }
  }

  if (!matchedSentence) return null;

  return {
    sentence: matchedSentence,
    word: targetWord,
    paragraphNum: finalParagraphNum
  };
};

interface QuizContextSentenceProps {
  questionText: string;
  lesson?: ReadingLesson | null;
}

export const QuizContextSentence: React.FC<QuizContextSentenceProps> = ({ questionText, lesson }) => {
  const match = getContextSentence(questionText, lesson);
  if (!match) return null;

  const { sentence, word, paragraphNum } = match;

  const highlightSentence = (s: string, w: string) => {
    const escapedWord = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedWord})`, 'gi');
    return s.split(regex).map((part, idx) => 
      part.toLowerCase() === w.toLowerCase() 
        ? <strong key={idx} style={{ color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '3px', fontWeight: '800' }}>{part}</strong>
        : part
    );
  };

  return (
    <div style={{ 
      marginTop: '0.85rem', 
      padding: '0.85rem 1.1rem', 
      background: 'rgba(6, 182, 212, 0.05)', 
      borderLeft: '4px solid var(--primary)', 
      borderRadius: '8px', 
      fontSize: '0.85rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      textAlign: 'left'
    }}>
      <span style={{ 
        color: 'var(--secondary)', 
        display: 'block', 
        fontSize: '0.65rem', 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        letterSpacing: '1px', 
        marginBottom: '0.4rem' 
      }}>
        📌 Context Sentence {paragraphNum ? `(Paragraph ${paragraphNum})` : ''}
      </span>
      <span style={{ color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>
        “{highlightSentence(sentence, word)}”
      </span>
    </div>
  );
};
