import { useCallback, useEffect, useRef, useState } from 'react';

export type PedometerStatus =
  | 'active'
  | 'needs_permission'
  | 'denied'
  | 'iframe_blocked'
  | 'unsupported';

interface UseAutoPedometerOptions {
  enabled: boolean;
  onStepsDetected: (deltaSteps: number) => void;
  onNotify?: (msg: string) => void;
}

interface SensorLike extends EventTarget {
  x?: number | null;
  y?: number | null;
  z?: number | null;
  start: () => void;
  stop: () => void;
}

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isAccelerometerPolicyBlocked(): boolean {
  if (typeof document === 'undefined') return false;
  const docAny = document as unknown as {
    permissionsPolicy?: { allowsFeature?: (f: string) => boolean };
    featurePolicy?: { allowsFeature?: (f: string) => boolean };
  };
  const policy = docAny.permissionsPolicy || docAny.featurePolicy;
  if (policy && typeof policy.allowsFeature === 'function') {
    try {
      return !policy.allowsFeature('accelerometer');
    } catch {
      return false;
    }
  }
  return false;
}

function hasAnyMotionSensorApi(): boolean {
  if (typeof window === 'undefined') return false;
  return 'DeviceMotionEvent' in window || 'Accelerometer' in window;
}

const KEEP_ALIVE_PREF_KEY = 'animefit_pedometer_keepalive_v1';

function readKeepAlivePref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEEP_ALIVE_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function useAutoPedometer({
  enabled,
  onStepsDetected,
  onNotify,
}: UseAutoPedometerOptions) {
  const [status, setStatus] = useState<PedometerStatus>(() => {
    if (!hasAnyMotionSensorApi()) {
      return 'unsupported';
    }
    if (isAccelerometerPolicyBlocked()) {
      return 'iframe_blocked';
    }
    const maybeIos = (
      typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : {}
    ) as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof maybeIos.requestPermission === 'function') {
      return 'needs_permission';
    }
    return 'active';
  });

  const [hasMotionEvents, setHasMotionEvents] = useState(false);
  const [keepAliveEnabled, setKeepAliveEnabled] = useState<boolean>(() =>
    readKeepAlivePref()
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [resumeTick, setResumeTick] = useState(0);

  const wakeLockSupported =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    typeof navigator.wakeLock?.request === 'function';

  const onStepsRef = useRef(onStepsDetected);
  onStepsRef.current = onStepsDetected;

  // Sync with browser Permissions API when supported (Chrome/Brave Android)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return;
    }
    let mounted = true;
    let permObj: PermissionStatus | null = null;

    const applyPermissionState = (state: PermissionState) => {
      if (!mounted) return;
      if (isAccelerometerPolicyBlocked()) {
        setStatus('iframe_blocked');
        return;
      }
      if (state === 'denied') {
        setStatus(isInIframe() ? 'iframe_blocked' : 'denied');
      } else if (state === 'prompt') {
        setStatus('needs_permission');
      } else if (state === 'granted') {
        const maybeIos = (
          typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : {}
        ) as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>;
        };
        if (typeof maybeIos.requestPermission !== 'function') {
          setStatus('active');
        }
      }
    };

    void navigator.permissions
      .query({ name: 'accelerometer' as PermissionName })
      .then((res) => {
        if (!mounted) return;
        permObj = res;
        applyPermissionState(res.state);
        res.onchange = () => applyPermissionState(res.state);
      })
      .catch(() => {
        // Browser does not support querying 'accelerometer' via Permissions API
      });

    return () => {
      mounted = false;
      if (permObj) {
        permObj.onchange = null;
      }
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!hasAnyMotionSensorApi()) {
      setStatus('unsupported');
      onNotify?.('Tu dispositivo no cuenta con sensor de movimiento.');
      return;
    }

    if (isAccelerometerPolicyBlocked()) {
      setStatus('iframe_blocked');
      onNotify?.(
        'La vista previa bloquea el sensor. Abre la app en una pestaña nueva para activar los pasos.'
      );
      return;
    }

    const maybeIos = (
      typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : {}
    ) as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    // Must be called immediately on user gesture for iOS Safari / Brave mobile
    if (typeof maybeIos.requestPermission === 'function') {
      try {
        const perm = await maybeIos.requestPermission();
        if (perm === 'granted') {
          setStatus('active');
          onNotify?.('Podómetro automático activado.');
          return;
        }
        if (isInIframe()) {
          setStatus('iframe_blocked');
          onNotify?.(
            'El navegador bloqueó el sensor dentro de la vista previa. Abre la app en una pestaña nueva.'
          );
        } else {
          setStatus('denied');
          onNotify?.(
            'Permiso bloqueado. Activa "Sensores de movimiento" en los ajustes de tu navegador.'
          );
        }
        return;
      } catch {
        if (isInIframe()) {
          setStatus('iframe_blocked');
          onNotify?.(
            'La vista previa bloquea el sensor. Abre la app en una pestaña nueva.'
          );
          return;
        }
      }
    }

    // Probe Generic Sensor API (Accelerometer) on Chromium / Brave Android
    const winAny = window as unknown as {
      Accelerometer?: new (opts?: { frequency?: number }) => SensorLike;
    };
    if (typeof winAny.Accelerometer === 'function') {
      try {
        const probeResult = await new Promise<'granted' | 'denied'>((resolve) => {
          const sensor = new winAny.Accelerometer!({ frequency: 15 });
          let settled = false;
          const finish = (res: 'granted' | 'denied') => {
            if (settled) return;
            settled = true;
            try {
              sensor.stop();
            } catch {
              // ignore
            }
            resolve(res);
          };
          const timer = window.setTimeout(() => finish('granted'), 450);
          sensor.addEventListener('reading', () => {
            window.clearTimeout(timer);
            finish('granted');
          });
          sensor.addEventListener('error', (ev: Event) => {
            window.clearTimeout(timer);
            const errName = (ev as unknown as { error?: { name?: string } })?.error?.name;
            if (errName === 'NotAllowedError' || errName === 'SecurityError') {
              finish('denied');
            } else {
              finish('granted');
            }
          });
          sensor.start();
        });

        if (probeResult === 'denied') {
          if (isInIframe()) {
            setStatus('iframe_blocked');
            onNotify?.(
              'El sensor está bloqueado dentro de la vista previa. Abre la app en una pestaña nueva.'
            );
          } else {
            setStatus('denied');
            onNotify?.(
              'Permiso bloqueado. Activa "Sensores de movimiento" en el candado o escudo de tu navegador.'
            );
          }
          return;
        }
      } catch {
        // Fallback to DeviceMotionEvent below
      }
    }

    setStatus('active');
    onNotify?.('Podómetro automático activado.');
  }, [onNotify]);

  const toggleKeepAlive = useCallback(() => {
    setKeepAliveEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEEP_ALIVE_PREF_KEY, next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      onNotify?.(
        next
          ? 'Modo Caminata activo: la pantalla se mantendrá despierta para no pausar el sensor.'
          : 'Modo Caminata desactivado.'
      );
      return next;
    });
  }, [onNotify]);

  // Manage Screen Wake Lock during active walking mode and re-acquire when returning to foreground
  useEffect(() => {
    if (!enabled || status !== 'active' || !keepAliveEnabled) {
      setWakeLockActive(false);
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !('wakeLock' in navigator) ||
      typeof navigator.wakeLock?.request !== 'function'
    ) {
      setWakeLockActive(false);
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        setWakeLockActive(true);
        lock.addEventListener('release', () => {
          if (!cancelled) setWakeLockActive(false);
        });
      } catch {
        if (!cancelled) setWakeLockActive(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
      setWakeLockActive(false);
    };
  }, [enabled, status, keepAliveEnabled]);

  // Trigger clean sensor re-bind when returning from background/sleep
  useEffect(() => {
    if (!enabled || status !== 'active') return;
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        setResumeTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('pageshow', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [enabled, status]);

  useEffect(() => {
    if (!enabled || status !== 'active') return;

    let avgMag = 9.81;
    let wasAbove = false;
    let lastPeakAt = 0;
    let cadenceBuffer = 0;
    let inWalkingCadence = false;
    let pendingFlushSteps = 0;
    let flushTimer: number | null = null;
    let sawDeviceMotion = false;
    let genericSensor: SensorLike | null = null;
    let sensorStartTimer: number | null = null;

    const flush = () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (pendingFlushSteps > 0) {
        const count = pendingFlushSteps;
        pendingFlushSteps = 0;
        onStepsRef.current(count);
      }
    };

    const scheduleFlush = () => {
      if (pendingFlushSteps >= 4) {
        flush();
        return;
      }
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
      }
      flushTimer = window.setTimeout(flush, 1500);
    };

    const processAccelerationSample = (x: number, y: number, z: number) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      if (!Number.isFinite(mag) || mag <= 0) return;

      avgMag = avgMag * 0.88 + mag * 0.12;
      const delta = mag - avgMag;
      const nowMs = Date.now();

      // Anti-cheat cadence filter:
      // Reject violent shaking spikes (>= 16 m/s^2), require >= 300ms between steps,
      // and require 4 rhythmic steps within 1.9s intervals before counting starts.
      if (delta > 1.75 && delta < 16 && !wasAbove && nowMs - lastPeakAt >= 300) {
        wasAbove = true;
        const gap = lastPeakAt > 0 ? nowMs - lastPeakAt : 0;
        lastPeakAt = nowMs;

        if (gap > 1900 || gap === 0) {
          cadenceBuffer = 1;
          inWalkingCadence = false;
        } else if (!inWalkingCadence) {
          cadenceBuffer += 1;
          if (cadenceBuffer >= 4) {
            inWalkingCadence = true;
            pendingFlushSteps += cadenceBuffer;
            cadenceBuffer = 0;
            scheduleFlush();
          }
        } else {
          pendingFlushSteps += 1;
          scheduleFlush();
        }
      } else if (delta < 0.65) {
        wasAbove = false;
      }
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;
      if (!sawDeviceMotion) {
        sawDeviceMotion = true;
        setHasMotionEvents(true);
        if (genericSensor) {
          try {
            genericSensor.stop();
          } catch {
            // ignore
          }
          genericSensor = null;
        }
      }
      processAccelerationSample(
        Number(acc.x || 0),
        Number(acc.y || 0),
        Number(acc.z || 0)
      );
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    const handleUnload = () => {
      flush();
    };

    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleMotion);
    }

    // Fallback to Generic Sensor API (Accelerometer) if DeviceMotionEvent stays quiet
    const winAny = window as unknown as {
      Accelerometer?: new (opts?: { frequency?: number }) => SensorLike;
    };
    if (typeof winAny.Accelerometer === 'function') {
      sensorStartTimer = window.setTimeout(() => {
        if (sawDeviceMotion) return;
        try {
          const sensor = new winAny.Accelerometer!({ frequency: 25 });
          sensor.addEventListener('reading', () => {
            if (sawDeviceMotion) {
              try {
                sensor.stop();
              } catch {
                // ignore
              }
              return;
            }
            setHasMotionEvents(true);
            processAccelerationSample(
              Number(sensor.x || 0),
              Number(sensor.y || 0),
              Number(sensor.z || 0)
            );
          });
          sensor.addEventListener('error', (ev: Event) => {
            const errName = (ev as unknown as { error?: { name?: string } })?.error?.name;
            if (!sawDeviceMotion && (errName === 'NotAllowedError' || errName === 'SecurityError')) {
              setStatus(isInIframe() ? 'iframe_blocked' : 'denied');
            }
          });
          sensor.start();
          genericSensor = sensor;
        } catch {
          // Ignore if sensor constructor is unavailable
        }
      }, 900);
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (sensorStartTimer !== null) {
        window.clearTimeout(sensorStartTimer);
      }
      if ('DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', handleMotion);
      }
      if (genericSensor) {
        try {
          genericSensor.stop();
        } catch {
          // ignore
        }
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      flush();
    };
  }, [enabled, status, resumeTick]);

  return {
    pedometerStatus: status,
    hasMotionEvents,
    keepAliveEnabled,
    wakeLockActive,
    wakeLockSupported,
    toggleKeepAlive,
    requestPedometerPermission: requestPermission,
  };
}
