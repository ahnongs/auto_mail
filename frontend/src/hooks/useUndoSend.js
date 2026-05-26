import { useState, useRef, useEffect } from 'react'

export function useUndoSend(seconds = 10) {
  const [pending, setPending] = useState(false)
  const [countdown, setCountdown] = useState(seconds)
  const sendTimerRef = useRef(null)
  const countdownRef = useRef(null)
  const sendFnRef = useRef(null)

  const schedule = (sendFn) => {
    sendFnRef.current = sendFn
    setPending(true)
    setCountdown(seconds)

    countdownRef.current = setInterval(() => {
      setCountdown(c => c - 1)
    }, 1000)

    sendTimerRef.current = setTimeout(async () => {
      clearInterval(countdownRef.current)
      setPending(false)
      await sendFn()
    }, seconds * 1000)
  }

  const cancel = () => {
    clearTimeout(sendTimerRef.current)
    clearInterval(countdownRef.current)
    setPending(false)
    setCountdown(seconds)
    sendFnRef.current = null
  }

  const sendNow = async () => {
    clearTimeout(sendTimerRef.current)
    clearInterval(countdownRef.current)
    setPending(false)
    setCountdown(seconds)
    const fn = sendFnRef.current
    sendFnRef.current = null
    if (fn) await fn()
  }

  useEffect(() => () => {
    clearTimeout(sendTimerRef.current)
    clearInterval(countdownRef.current)
  }, [])

  return { pending, countdown, schedule, cancel, sendNow }
}
