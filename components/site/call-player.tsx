'use client'

import { Check, Pause, Play, RotateCcw, Volume2, VolumeX, Wrench } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { duration } from '@/lib/format'
import type { Locale } from '@/lib/i18n'

export type PlayerTurn = { role: 'agent' | 'caller'; text: string; at: number }
export type PlayerTool = { name: string; success: boolean; latencyMs: number | null; at: number }

/**
 * Plays a call back on its own timeline.
 *
 * There is no recording yet, so this does not pretend to be one: it replays the
 * stored transcript and tool executions at their real timestamps, which is
 * genuine data rather than a decorative animation. `audioSrc` is the drop-in
 * for a real recording — when one is supplied the audio element drives the
 * clock instead of the internal timer, and everything else is unchanged.
 *
 * The optional read-aloud uses the browser's own speech synthesis and is
 * labelled as such. It is not the agent's voice and is never presented as one.
 */
export function CallPlayer({
  locale,
  title,
  meta,
  turns,
  tools,
  totalSeconds,
  outcome,
  audioSrc,
}: {
  locale: Locale
  title: string
  meta: string
  turns: PlayerTurn[]
  tools: PlayerTool[]
  totalSeconds: number
  outcome?: { label: string; detail: string } | undefined
  audioSrc?: string | undefined
}) {
  const ar = locale === 'ar'
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [speak, setSpeak] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const rafRef = useRef<number>(0)
  const startedAt = useRef(0)
  const spokenUpTo = useRef(-1)
  const scrollRef = useRef<HTMLDivElement>(null)

  const total = Math.max(1, totalSeconds)

  useEffect(() => {
    setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window)
    return () => window.speechSynthesis?.cancel()
  }, [])

  /* ── clock ─────────────────────────────────────────────────────────── */

  const tick = useCallback(() => {
    const elapsed = (performance.now() - startedAt.current) / 1000
    if (elapsed >= total) {
      setT(total)
      setPlaying(false)
      return
    }
    setT(elapsed)
    rafRef.current = requestAnimationFrame(tick)
  }, [total])

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      window.speechSynthesis?.cancel()
      return
    }
    if (audioSrc) return // the audio element owns the clock
    startedAt.current = performance.now() - t * 1000
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, tick, audioSrc, t])

  /* ── read aloud ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!playing || !speak || !canSpeak) return
    const due = turns.findLastIndex((turn) => turn.at <= t)
    if (due < 0 || due === spokenUpTo.current) return
    spokenUpTo.current = due

    const turn = turns[due]
    if (!turn) return
    const utterance = new SpeechSynthesisUtterance(turn.text)
    utterance.lang = ar ? 'ar-SA' : 'en-US'
    utterance.rate = 1.02
    // Distinguish the two sides so the playback is followable by ear.
    utterance.pitch = turn.role === 'agent' ? 1 : 0.85
    window.speechSynthesis.speak(utterance)
  }, [t, playing, speak, canSpeak, turns, ar])

  /* ── derived ───────────────────────────────────────────────────────── */

  const items = useMemo(() => {
    const merged: (({ kind: 'turn' } & PlayerTurn) | ({ kind: 'tool' } & PlayerTool))[] = [
      ...turns.map((x) => ({ kind: 'turn' as const, ...x })),
      ...tools.map((x) => ({ kind: 'tool' as const, ...x })),
    ]
    return merged.sort((a, b) => a.at - b.at)
  }, [turns, tools])

  const visible = items.filter((i) => i.at <= t)
  const finished = t >= total

  // Keep the newest line in view while playing.
  useEffect(() => {
    if (!playing) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [playing])

  function toggle() {
    if (finished) {
      restart()
      return
    }
    if (audioSrc) {
      const a = audioRef.current
      if (!a) return
      if (playing) a.pause()
      else void a.play()
    }
    setPlaying((p) => !p)
  }

  function restart() {
    spokenUpTo.current = -1
    window.speechSynthesis?.cancel()
    setT(0)
    if (audioSrc && audioRef.current) {
      audioRef.current.currentTime = 0
      void audioRef.current.play()
    }
    startedAt.current = performance.now()
    setPlaying(true)
  }

  function seek(next: number) {
    spokenUpTo.current = -1
    window.speechSynthesis?.cancel()
    setT(next)
    startedAt.current = performance.now() - next * 1000
    if (audioSrc && audioRef.current) audioRef.current.currentTime = next
  }

  const progress = (t / total) * 100
  const labels = ar ? { agent: 'مُجاوِب', caller: 'المتصل' } : { agent: 'Mujawib', caller: 'Caller' }

  return (
    <figure className="player">
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        >
          <track kind="captions" />
        </audio>
      ) : null}

      <header className="player__head">
        <button
          type="button"
          className="player__play"
          onClick={toggle}
          aria-label={playing ? (ar ? 'إيقاف' : 'Pause') : ar ? 'تشغيل' : 'Play'}
        >
          {finished ? <RotateCcw size={18} /> : playing ? <Pause size={18} /> : <Play size={18} />}
        </button>

        <span className="player__title">
          <strong>{title}</strong>
          <span>{meta}</span>
        </span>

        {canSpeak ? (
          <button
            type="button"
            className="player__speak"
            onClick={() => setSpeak((v) => !v)}
            aria-pressed={speak}
            title={ar ? 'قراءة بصوت المتصفح — ليست صوت المُجاوِب' : 'Browser voice — not the agent'}
          >
            {speak ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{ar ? 'اقرأ بصوت المتصفح' : 'Read aloud'}</span>
          </button>
        ) : null}
      </header>

      <div className="player__bar">
        <span className="player__time mono">{duration(Math.floor(t))}</span>
        <label className="player__scrub">
          <span className="visually-hidden">{ar ? 'موضع التشغيل' : 'Playback position'}</span>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={Math.floor(t)}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span
            className="player__fill"
            style={{ inlineSize: `${progress}%` }}
            aria-hidden="true"
          />
        </label>
        <span className="player__time mono">{duration(total)}</span>
      </div>

      <div className="player__wave" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => {
          const at = (i / 48) * total
          const past = at <= t
          // A stable pseudo-random height per bar, so the shape does not
          // reshuffle on every render.
          const h = 22 + ((i * 37) % 60)
          return (
            <i
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative bar set
              key={`bar-${i}-${h}`}
              data-past={past}
              data-active={playing && Math.abs(at - t) < total / 48}
              style={{ height: `${h}%` }}
            />
          )
        })}
      </div>

      <div className="player__body" ref={scrollRef}>
        {visible.length === 0 ? (
          <p className="player__hint">
            {ar ? 'اضغط تشغيل لتتابع المكالمة لحظة بلحظة.' : 'Press play to follow the call.'}
          </p>
        ) : (
          visible.map((item, i) =>
            item.kind === 'turn' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: two events can share a second
              <div key={`t-${item.at}-${i}`} className={`pline pline--${item.role}`}>
                <span className="pline__at mono">{duration(item.at)}</span>
                <div>
                  <span className="pline__who">
                    {item.role === 'agent' ? labels.agent : labels.caller}
                  </span>
                  <p>{item.text}</p>
                </div>
              </div>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: two events can share a second
              <div key={`x-${item.at}-${i}`} className="pline pline--tool">
                <span className="pline__at mono">{duration(item.at)}</span>
                <div className="pline__tool">
                  <Wrench size={13} aria-hidden="true" />
                  <code>{item.name}</code>
                  {item.success ? (
                    <Check size={13} style={{ color: 'var(--good)' }} aria-hidden="true" />
                  ) : null}
                  {item.latencyMs ? <span>{item.latencyMs}ms</span> : null}
                </div>
              </div>
            ),
          )
        )}
      </div>

      {outcome && finished ? (
        <figcaption className="player__outcome">
          <Check size={16} aria-hidden="true" />
          <span>{outcome.label}</span>
          <span className="mono">{outcome.detail}</span>
        </figcaption>
      ) : null}

      {!audioSrc ? (
        <p className="player__note">
          {ar
            ? 'إعادة تشغيل زمنية للحوار والأدوات كما سُجّلت. التسجيل الصوتي يُضاف هنا عند توفره.'
            : 'A timed replay of the recorded transcript and tool calls. Audio drops in here when available.'}
        </p>
      ) : null}
    </figure>
  )
}
