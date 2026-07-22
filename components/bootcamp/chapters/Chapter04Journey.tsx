'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ChapterMark, GridBackdrop, NoiseOverlay } from './primitives';

interface Day {
  day: number;
  title: string;
  topics: string[];
}

const days: Day[] = [
  {
    day: 1,
    title: 'AI Foundations',
    topics: [
      'How LLMs actually work — tokens, context windows, embeddings',
      'The real AI landscape: models, APIs, and where each one fits',
      'Setting up your dev environment: Node.js, React, Cursor AI',
      'Your first AI-assisted commit using Cursor AI',
    ],
  },
  {
    day: 2,
    title: 'Prompt Engineering',
    topics: [
      'System prompts vs user prompts — what production apps actually send',
      'Zero-shot, few-shot, and chain-of-thought prompting',
      'Structured outputs: getting reliable JSON out of an LLM',
      'Prompt patterns that break, and how to debug them',
    ],
  },
  {
    day: 3,
    title: 'React + AI',
    topics: [
      'Building AI-native UI components in React',
      'Streaming LLM responses into the browser in real time',
      'Managing chat state, history, and loading states cleanly',
      'Hands-on: wiring a React front end to a live AI backend',
    ],
  },
  {
    day: 4,
    title: 'OpenAI APIs',
    topics: [
      'The Chat Completions API — roles, messages, function calling',
      'Structured output and tool calling for real app logic',
      'Handling errors, rate limits, and token costs in production',
      'Building the AI Chatbot project end-to-end',
    ],
  },
  {
    day: 5,
    title: 'MCP & AI Agents',
    topics: [
      'What the Model Context Protocol (MCP) actually solves',
      'Building a tool-using AI agent from scratch',
      'Connecting agents to real data sources and APIs',
      'Where agents fit vs a plain API call — a practical decision framework',
    ],
  },
  {
    day: 6,
    title: 'Deployment',
    topics: [
      'Deploying a full-stack AI app to production (Vercel + Node backend)',
      'Managing environment variables and API keys securely',
      'Production considerations: rate limiting, cost control, monitoring',
      'Shipping a live, shareable link for your project',
    ],
  },
  {
    day: 7,
    title: 'Capstone Project',
    topics: [
      'Scoping and building your own AI application, mentor-guided',
      'Live debugging and code review with the cohort',
      'Demo Day: present your project to the full batch',
      'Walking away with a deployed app and a GitHub repo to show recruiters',
    ],
  },
];

export function ChapterJourney() {
  const [active, setActive] = useState(0);
  const current = days[active];

  return (
    <section id="journey" className="b-chapter b-chapter-dark" style={{ padding: '112px 0' }}>
      <GridBackdrop animate={false} />
      <NoiseOverlay />

      <div className="b-container relative">
        <div className="text-center mb-16">
          <ChapterMark index="06" label="Inside The 7 Days" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 640, margin: '0 auto' }}>
            One live session a day. Seven working AI skills.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-16">
          {/* Day rail */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto b-rail lg:overflow-visible pb-2 lg:pb-0">
            {days.map((d, i) => {
              const isActive = i === active;
              return (
                <button
                  key={d.day}
                  onClick={() => setActive(i)}
                  className="shrink-0 lg:shrink-none flex items-center gap-3 text-left rounded-xl px-4 py-3 transition-all duration-200"
                  style={{
                    background: isActive ? 'rgba(22,93,252,0.12)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(22,93,252,0.45)' : 'var(--b-line-dark)'}`,
                    minWidth: 172,
                  }}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-xs font-bold shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      background: isActive ? 'var(--b-blue)' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#fff' : 'var(--b-text-onDark-muted)',
                    }}
                  >
                    {d.day}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: isActive ? '#fff' : 'var(--b-text-onDark-muted)' }}>
                    {d.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.day}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
              className="b-glass rounded-3xl p-8 sm:p-10"
            >
              <p className="b-eyebrow mb-4">Day {current.day}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 24 }}>{current.title}</h3>
              <ul className="space-y-4">
                {current.topics.map((topic) => (
                  <li key={topic} className="flex items-start gap-3 text-sm">
                    <ArrowRight size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--b-blue-soft)' }} />
                    <span style={{ color: 'var(--b-text-onDark)', lineHeight: 1.65 }}>{topic}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
