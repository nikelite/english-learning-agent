import React, { useState, useEffect } from 'react';
import type { MochiDeck, MochiCard } from '../types';
import { 
  BookOpen, 
  HelpCircle, 
  RotateCw, 
  Check, 
  Award, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  Info,
  Sparkles,
  Volume2
} from 'lucide-react';

interface MochiStudyRoomProps {
  deck: MochiDeck;
  onClose: () => void;
}

export const MochiStudyRoom: React.FC<MochiStudyRoomProps> = ({ deck, onClose }) => {
  const [cards, setCards] = useState<MochiCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyStyle, setStudyStyle] = useState<'eng-first' | 'kor-first'>('eng-first');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [studyQueue, setStudyQueue] = useState<MochiCard[]>([]);
  const [completed, setCompleted] = useState(false);

  // Initialize deck cards
  useEffect(() => {
    if (deck.cards && deck.cards.length > 0) {
      setCards(deck.cards);
      setStudyQueue([...deck.cards]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSelectedOption(null);
      setQuizAnswered(false);
      setScore(0);
      setWrongCount(0);
      setCompleted(false);
    }
  }, [deck]);

  if (!deck.cards || deck.cards.length === 0) {
    return (
      <div className="study-room-empty">
        <HelpCircle size={48} className="text-muted" />
        <h3>학습할 카드가 없습니다.</h3>
        <p>이 덱에는 아직 생성된 카드가 없습니다.</p>
        <button onClick={onClose} className="btn btn-secondary">돌아가기</button>
      </div>
    );
  }

  const currentCard = deck.mode === 'study' ? studyQueue[currentIndex] : cards[currentIndex];

  // TTS speak helper
  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel previous speaking
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Study Mode Handlers
  const handleGotIt = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex + 1 >= studyQueue.length) {
        setCompleted(true);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 200);
  };

  const handleNeedReview = () => {
    // Put current card at the end of the queue for re-studying
    const updatedQueue = [...studyQueue];
    const current = updatedQueue[currentIndex];
    // Push a copy to the back of the queue
    updatedQueue.push(current);
    setStudyQueue(updatedQueue);

    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
    }, 200);
  };

  // Quiz Mode Handlers
  const handleOptionClick = (optionIdx: number) => {
    if (quizAnswered) return;
    setSelectedOption(optionIdx);
    setQuizAnswered(true);

    const isCorrect = optionIdx === currentCard.correctIndex;
    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      setWrongCount(prev => prev + 1);
    }
    
    // Pronounce correct answer automatically in quiz mode
    speakWord(currentCard.english);
  };

  const handleNextQuiz = () => {
    setSelectedOption(null);
    setQuizAnswered(false);
    if (currentIndex + 1 >= cards.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleRestart = () => {
    setStudyQueue([...deck.cards]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setQuizAnswered(false);
    setScore(0);
    setWrongCount(0);
    setCompleted(false);
  };

  // Helper to format the quiz sentence showing blank or answer
  const formatQuizSentence = (sentence: string, showAnswer: boolean) => {
    const regex = /\{\{c1::(.*?)\}\}/gi;
    if (showAnswer) {
      // Replace with highlighted answer
      return sentence.replace(regex, `<span class="quiz-highlight-correct">$1</span>`);
    } else {
      // Replace with styled blank
      return sentence.replace(regex, `<span class="quiz-blank">________</span>`);
    }
  };

  return (
    <div className="study-room-container">
      {/* Study Header */}
      <div className="study-header">
        <div className="study-info">
          <span className="deck-mode-badge">
            {deck.mode === 'study' ? (
              <>
                <BookOpen size={14} /> 암기 카드 모드
              </>
            ) : (
              <>
                <HelpCircle size={14} /> 퀴즈 모드
              </>
            )}
          </span>
          <h2 className="deck-title-display">{deck.name}</h2>
        </div>
        <button onClick={onClose} className="study-close-btn" aria-label="학습 종료">
          닫기 &times;
        </button>
      </div>

      {completed ? (
        /* Completed Screen */
        <div className="completed-screen text-center animate-fade-in">
          <div className="award-icon-container">
            <Award size={64} className="text-primary animate-pulse" />
          </div>
          <h2>학습 완료! 🎉</h2>
          <p className="subtitle">
            {deck.name} 덱의 모든 학습을 성공적으로 마쳤습니다.
          </p>

          {deck.mode === 'quiz' ? (
            <div className="quiz-result-stats">
              <div className="stat-card">
                <span className="label">정답</span>
                <span className="value text-success">{score}</span>
              </div>
              <div className="stat-card">
                <span className="label">오답</span>
                <span className="value text-danger">{wrongCount}</span>
              </div>
              <div className="stat-card">
                <span className="label">정답률</span>
                <span className="value text-primary">
                  {Math.round((score / cards.length) * 100)}%
                </span>
              </div>
            </div>
          ) : (
            <p className="study-complete-desc">
              총 <strong>{cards.length}</strong>개의 단어를 학습 완료했습니다.
            </p>
          )}

          <div className="study-action-buttons">
            <button onClick={handleRestart} className="btn btn-primary">
              <RotateCw size={16} /> 다시 학습하기
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      ) : (
        /* Active Study/Quiz Screen */
        <div className="study-body">
          {/* Progress Bar */}
          <div className="study-progress-container">
            <div className="progress-bar-text">
              {deck.mode === 'study' ? (
                <span>학습 진행도: <strong>{currentIndex + 1}</strong> / {studyQueue.length}</span>
              ) : (
                <span>퀴즈 문항: <strong>{currentIndex + 1}</strong> / {cards.length}</span>
              )}
              {deck.mode === 'quiz' && (
                <span className="score-text">맞춘 퀴즈: {score}</span>
              )}
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{ 
                  width: `${deck.mode === 'study' 
                    ? ((currentIndex + 1) / studyQueue.length) * 100 
                    : ((currentIndex + 1) / cards.length) * 100}%` 
                }}
              />
            </div>
          </div>

          {deck.mode === 'study' ? (
            /* Study Mode View */
            <div className="study-card-view">
              <div className="study-settings-bar">
                <span className="label">레이아웃:</span>
                <div className="toggle-group">
                  <button 
                    className={`toggle-btn ${studyStyle === 'eng-first' ? 'active' : ''}`}
                    onClick={() => { setStudyStyle('eng-first'); setIsFlipped(false); }}
                  >
                    영어 먼저
                  </button>
                  <button 
                    className={`toggle-btn ${studyStyle === 'kor-first' ? 'active' : ''}`}
                    onClick={() => { setStudyStyle('kor-first'); setIsFlipped(false); }}
                  >
                    한국어 뜻 먼저
                  </button>
                </div>
              </div>

              {/* 3D Flip Card */}
              <div 
                className={`flashcard-3d-wrapper ${isFlipped ? 'flipped' : ''}`}
                onClick={() => {
                  setIsFlipped(!isFlipped);
                  if (!isFlipped && studyStyle === 'eng-first') {
                    // Pronounce word when flipping to reveal details (English front)
                    speakWord(currentCard.english);
                  } else if (isFlipped && studyStyle === 'kor-first') {
                    // Pronounce when flipping from Kor -> Eng details
                    speakWord(currentCard.english);
                  }
                }}
              >
                <div className="flashcard-inner">
                  {/* Card Front */}
                  <div className="flashcard-face flashcard-front">
                    <div className="card-top-header">
                      <span className="pos-badge">{currentCard.pos}</span>
                      <button 
                        className="tts-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(currentCard.english);
                        }}
                        title="발음 듣기"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                    <div className="card-front-content">
                      {studyStyle === 'eng-first' ? (
                        <div className="term-text font-english">{currentCard.english}</div>
                      ) : (
                        <div className="term-text font-korean">{currentCard.korean}</div>
                      )}
                      <p className="flip-hint">카드를 탭하여 뜻 확인하기</p>
                    </div>
                  </div>

                  {/* Card Back */}
                  <div className="flashcard-face flashcard-back">
                    <div className="card-top-header">
                      <span className="pos-badge">{currentCard.pos}</span>
                      <button 
                        className="tts-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(currentCard.english);
                        }}
                        title="발음 듣기"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                    <div className="card-back-content">
                      {studyStyle === 'eng-first' ? (
                        <>
                          <h2 className="back-term font-korean">{currentCard.korean}</h2>
                          <div className="back-details-divider" />
                          <h4 className="back-original-term font-english">
                            {currentCard.english} {currentCard.phonetic && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: 'normal' }}>{currentCard.phonetic}</span>}
                          </h4>
                        </>
                      ) : (
                        <>
                          <h2 className="back-term font-english">
                            {currentCard.english} {currentCard.phonetic && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: 'normal' }}>{currentCard.phonetic}</span>}
                          </h2>
                          <div className="back-details-divider" />
                          <h4 className="back-original-term font-korean">{currentCard.korean}</h4>
                        </>
                      )}

                      {/* Example sentences */}
                      <div className="card-example-section">
                        <span className="section-label">Example Sentence</span>
                        <p className="example-eng font-english">{currentCard.exampleEng}</p>
                        <p className="example-kor font-korean">{currentCard.exampleKor}</p>
                      </div>

                      {/* Tip */}
                      {currentCard.tip && (
                        <div className="card-tip-section">
                          <span className="section-label">💡 AI Memorization Tip</span>
                          <p className="tip-text">{currentCard.tip}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Study Action Buttons */}
              <div className="study-actions-bar">
                <button onClick={handleNeedReview} className="study-action-btn need-review">
                  <RotateCw size={16} /> 다시 보기 (Review)
                </button>
                <button onClick={handleGotIt} className="study-action-btn got-it">
                  <Check size={16} /> 알겠음 (Got It)
                </button>
              </div>
            </div>
          ) : (
            /* Quiz Mode View */
            <div className="quiz-card-view animate-fade-in">
              {/* Question card */}
              <div className="quiz-question-card">
                <div className="quiz-card-header">
                  <span className="pos-badge">{currentCard.pos}</span>
                  <div className="quiz-controls-right">
                    {currentCard.phonetic && <span className="phonetic-display">{currentCard.phonetic}</span>}
                    <button 
                      className="tts-btn"
                      onClick={() => speakWord(currentCard.english)}
                      title="발음 듣기"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="quiz-question-body">
                  <p 
                    className="quiz-sentence font-english"
                    dangerouslySetInnerHTML={{ 
                      __html: formatQuizSentence(currentCard.exampleEng, quizAnswered) 
                    }}
                  />
                  {quizAnswered && (
                    <p className="quiz-translation font-korean animate-fade-in">
                      {currentCard.korean}
                    </p>
                  )}
                </div>
              </div>

              {/* Options list */}
              <div className="quiz-options-list">
                {currentCard.options?.map((option, index) => {
                  const letter = String.fromCharCode(65 + index);
                  const isCorrect = index === currentCard.correctIndex;
                  const isSelected = index === selectedOption;

                  let optionClass = 'quiz-option-btn';
                  if (quizAnswered) {
                    if (isCorrect) {
                      optionClass += ' correct';
                    } else if (isSelected) {
                      optionClass += ' incorrect';
                    } else {
                      optionClass += ' disabled';
                    }
                  }

                  return (
                    <button
                      key={index}
                      className={optionClass}
                      onClick={() => handleOptionClick(index)}
                      disabled={quizAnswered}
                    >
                      <span className="option-letter">{letter}</span>
                      <span className="option-text font-english">{option}</span>
                      {quizAnswered && isCorrect && <CheckCircle2 size={18} className="option-status-icon text-success" />}
                      {quizAnswered && isSelected && !isCorrect && <XCircle size={18} className="option-status-icon text-danger" />}
                    </button>
                  );
                })}
              </div>

              {/* Rationale & Tip details */}
              {quizAnswered && (
                <div className="quiz-explanation-box animate-slide-up">
                  <div className="explanation-section">
                    <h4 className="section-title">
                      <Info size={16} /> 해설 (Rationale)
                    </h4>
                    <p className="explanation-text font-korean">{currentCard.rationale}</p>
                  </div>

                  {currentCard.tip && (
                    <div className="explanation-section">
                      <h4 className="section-title">
                        <Sparkles size={16} /> 암기 팁 (Memory Tip)
                      </h4>
                      <p className="explanation-text font-korean">{currentCard.tip}</p>
                    </div>
                  )}

                  <div className="next-action-container">
                    <button onClick={handleNextQuiz} className="btn btn-primary btn-next">
                      다음 문제로 <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
