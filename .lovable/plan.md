
Goal
- Fix the notification sound so admin reliably hears a sound on every incoming message from other users, and stop the current “no sound” failure.

What I found (root cause analysis)
- Incoming message flow is working:
  - Realtime events are being emitted from `useMessages` (`chat:new-message` custom event is dispatched on INSERT).
  - Message rows are arriving for admin in the database/network snapshots.
- Admin preference is not muted:
  - `chat_preferences.sound_option` for admin is currently `pop`.
- Current sound path is fragile:
  - `useChatPreferences` uses a shared `AudioContext` and a one-time warm-up listener (`click`/`keydown` with `{ once: true }`).
  - If the context is suspended/interrupted later, playback can fail because resume is attempted during a realtime callback (not a user gesture), and there is no persistent unlock/recovery strategy.
- Conclusion:
  - This is not a chat event issue; it is an audio context lifecycle/recovery issue.

Implementation plan
1) Harden notification audio engine in `src/hooks/useChatPreferences.ts`
- Replace one-shot warm-up with a resilient unlock strategy:
  - Add a small internal “audio manager” with:
    - `ensureAudioContext()` (creates context if missing/closed),
    - `resumeAudioContextFromGesture()` (called on user gestures),
    - state tracking (`running/suspended/interrupted`).
  - Register persistent lightweight listeners (e.g., `pointerdown`, `keydown`, `touchstart`, `visibilitychange`) to resume context whenever needed, not just once.
- Add defensive playback wrapper:
  - `safePlayBuiltIn(type)`:
    - If context is running, play beep immediately.
    - If not running, attempt resume; if still blocked, queue one pending play and execute on next gesture.
- Keep custom sound support, but with deterministic fallback chain:
  - custom audio attempt -> built-in `pop` fallback.
- Add a small anti-spam cooldown (e.g., 250–400ms) to avoid overlapping beep storms from burst inserts.

2) Make message event handling consume the hardened API in `src/components/mensajeria/FloatingChat.tsx`
- Keep current checks (`senderId !== user.id`, `!isSoundMuted`).
- Route notification trigger through the new robust `playNotificationSound` that can recover from suspended context and queue playback until next gesture.
- Keep mute button behavior unchanged (green active, red muted) as already requested.

3) Add focused runtime diagnostics for this bug (temporary, low-noise)
- Add guarded debug logs only when playback fails/retries (single-line structured logs).
- This allows immediate confirmation in preview console without affecting normal UX.
- After confirmation, remove or downgrade to silent handling if desired.

4) Verification plan (end-to-end, mandatory)
- Scenario A: Chat closed, admin on `/proyectos`, second user sends message -> admin hears sound.
- Scenario B: Chat open in active conversation -> admin hears sound on incoming message.
- Scenario C: Admin muted (red) -> no sound; unmute (green) -> sound returns.
- Scenario D: Leave tab idle/background briefly, return, receive message -> sound still works (recovery path validated).
- Scenario E: Custom sound selected but invalid/unreachable URL -> fallback `pop` still plays.

Files to change
- `src/hooks/useChatPreferences.ts` (main fix: resilient audio context + queued replay/fallback/cooldown)
- `src/components/mensajeria/FloatingChat.tsx` (consume robust notifier, keep UX/mute behavior)

Database / backend impact
- No schema or policy changes needed.
- Existing `chat_preferences` table and access rules are correct for this fix.

Risk and mitigation
- Risk: too many recovery listeners or repeated resumes.
  - Mitigation: centralize listener registration once, lightweight handlers, clean up on unmount, and throttle resume attempts.
- Risk: multiple quick message inserts causing audio clutter.
  - Mitigation: cooldown/debounce in notification playback.

Acceptance criteria
- Admin consistently hears a notification for incoming messages from other users when sound is active.
- Mute/unmute state is respected 100% of the time.
- Notification still works after idle/background transitions.
- No regressions in custom sound selection or chat performance.
