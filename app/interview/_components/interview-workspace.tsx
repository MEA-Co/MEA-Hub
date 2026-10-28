'use client';

import { FileText, Mic } from 'lucide-react';
import type { ReactNode } from 'react';

type Tab = 'activities' | 'interview';

export function InterviewWorkspace({
  activeTab,
  onTabChange,
  phase,
  children,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => boolean | void;
  phase: 'setup' | 'live' | 'result';
  children: ReactNode;
}) {
  return (
    <div className="mea-workspace">
      <header className="mea-app-header">
        <div className="mea-app-header-inner">
          <div className="mea-app-title">
            <span className="mea-brand">
              MEA
              <span className="mea-brand-point" aria-hidden />
            </span>
            <span className="mea-brand-caption">모의 면접</span>
          </div>
        </div>
      </header>
      <div className="mea-main">
        <div className="mea-topbar">
          <div
            role="tablist"
            aria-label="활동 입력과 면접"
            className="mea-section-tabs"
          >
            {(
              [
                { key: 'activities', label: '활동 입력', icon: FileText },
                { key: 'interview', label: '면접', icon: Mic },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                role="tab"
                id={`${key}-tab`}
                aria-controls={`${key}-panel`}
                aria-selected={activeTab === key}
                tabIndex={activeTab === key ? 0 : -1}
                key={key}
                onClick={() => onTabChange(key)}
                onKeyDown={(event) => {
                  if (
                    [
                      'ArrowLeft',
                      'ArrowRight',
                      'ArrowUp',
                      'ArrowDown',
                      'Home',
                      'End',
                    ].includes(event.key)
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 'activities'
                        : event.key === 'End'
                          ? 'interview'
                          : key === 'activities'
                            ? 'interview'
                            : 'activities';
                    if (onTabChange(next) !== false)
                      document.getElementById(`${next}-tab`)?.focus();
                  }
                }}
                className="mea-navigation-item"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <span className="mea-session-status">
            <span aria-hidden />
            {phase === 'live'
              ? '면접 진행 중'
              : phase === 'result'
                ? '면접 완료'
                : '면접 준비'}
          </span>
        </div>
        <main className="mea-content">{children}</main>
        <footer className="mea-workspace-footer">
          MEA Hub<span>면접 연습</span>
        </footer>
      </div>
    </div>
  );
}
