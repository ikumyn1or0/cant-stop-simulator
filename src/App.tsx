import { useCallback, useEffect, useState } from 'react';
import { Calculator } from './components/Calculator';
import { Match } from './components/Match';
import './App.css';

type Theme = 'light' | 'dark' | 'system';
type Tab = 'calculator' | 'match';

const THEME_ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
};

const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const TABS: { value: Tab; label: string }[] = [
  { value: 'calculator', label: '確率計算' },
  { value: 'match', label: 'AI対戦' },
];

function getInitialTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? 'system';
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [tab, setTab] = useState<Tab>('calculator');

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    setTheme(t => NEXT_THEME[t]);
  }, []);

  return (
    <div className="app">
      <header className="header">
        {/* 狭い画面で「シミュレ／ーター」と単語途中で割れるため、画面内は短い表記にする。
            正式名称はタブのタイトルと PWA の manifest 側で持つ。 */}
        <h1 className="title">キャントストップ</h1>
        <button type="button" className="btn btn--icon" onClick={cycleTheme} aria-label="テーマ切替">
          {THEME_ICONS[theme]}
        </button>
      </header>

      <nav className="tabs">
        {TABS.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className={`tab${tab === value ? ' is-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'calculator' ? <Calculator /> : <Match />}

      <footer className="footer">
        <a href="https://github.com/ikumyn1or0/cant-stop-simulator" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
