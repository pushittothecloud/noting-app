export interface SpeechConfig {
  provider: 'browser' | 'azure' | 'google'
  voiceURI: string | null
  rate: number
  pitch: number
  volume: number
  apiKey?: string
  azureRegion?: string
  azureVoiceName?: string
  googleVoiceName?: string
}

export interface SpeakTextOptions extends SpeechConfig {
  text: string
  lang?: string
  interrupt?: boolean
}

const CHUNK_MAX = 140
const GOOGLE_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize'

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return sortVoices(window.speechSynthesis.getVoices())
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  let score = 0

  if (name.includes('natural') || name.includes('neural')) score += 50
  if (name.includes('online')) score += 30
  if (!voice.localService) score += 10

  const isEdge = /edg\//i.test(navigator.userAgent)
  const isChrome = /chrome\//i.test(navigator.userAgent) && !isEdge

  if (isEdge && name.includes('microsoft')) score += 25
  if (isChrome && name.includes('google')) score += 25

  if (voice.default) score += 5
  return score
}

function sortVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))
}

export function getRecommendedVoiceURI(lang = 'en'): string | null {
  const voices = getAvailableVoices()
  const preferred = voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()))
  return preferred?.voiceURI ?? voices[0]?.voiceURI ?? null
}

export function resolveVoice(voiceURI: string | null, lang = 'en'): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices()
  if (!voices.length) return null

  if (voiceURI) {
    const exact = voices.find((voice) => voice.voiceURI === voiceURI)
    if (exact) return exact
  }

  const languageMatch = voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()))
  if (languageMatch) return languageMatch

  return voices.find((voice) => voice.default) ?? voices[0] ?? null
}

export function splitSpeechText(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const sentenceParts = normalized.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []

  for (const sentence of sentenceParts) {
    if (sentence.length <= CHUNK_MAX) {
      chunks.push(sentence)
      continue
    }

    const words = sentence.split(' ')
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length > CHUNK_MAX) {
        if (current) chunks.push(current)
        current = word
      } else {
        current = candidate
      }
    }

    if (current) chunks.push(current)
  }

  return chunks
}

export async function speakText(options: SpeakTextOptions): Promise<void> {
  if (!options.text.trim()) return

  if (options.provider === 'azure') {
    const success = await speakWithAzure(options)
    if (success) return
  }

  if (options.provider === 'google') {
    const success = await speakWithGoogle(options)
    if (success) return
  }

  await speakWithBrowser(options)
}

async function speakWithBrowser(options: SpeakTextOptions): Promise<void> {
  if (!('speechSynthesis' in window)) return

  const synth = window.speechSynthesis
  const chunks = splitSpeechText(options.text)
  if (!chunks.length) return

  const voice = resolveVoice(options.voiceURI, options.lang)

  if (options.interrupt ?? true) {
    synth.cancel()
  }

  // Some browsers keep the synthesizer paused after tab/background transitions.
  synth.resume()

  for (const chunk of chunks) {
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      let settled = false
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null

      const finish = () => {
        if (settled) return
        settled = true
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
        }
        resolve()
      }

      utterance.rate = options.rate
      utterance.pitch = options.pitch
      utterance.volume = options.volume
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else if (options.lang) {
        utterance.lang = options.lang
      }

      // Safety net for browsers that occasionally miss end/error callbacks.
      fallbackTimer = setTimeout(finish, Math.max(900, chunk.length * 90))

      utterance.onend = finish
      utterance.onerror = finish
      synth.speak(utterance)
    })
  }
}

async function speakWithAzure(options: SpeakTextOptions): Promise<boolean> {
  if (!options.apiKey) return false
  const region = options.azureRegion?.trim() || 'eastus'
  const voiceName = options.azureVoiceName || 'en-US-JennyNeural'

  try {
    const xml = buildAzureSsml({
      text: options.text,
      voiceName,
      rate: options.rate,
      pitch: options.pitch,
    })

    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'Ocp-Apim-Subscription-Key': options.apiKey,
      },
      body: xml,
    })

    if (!response.ok) return false
    const audioBlob = await response.blob()
    playBlobAudio(audioBlob, options.interrupt ?? true)
    return true
  } catch {
    return false
  }
}

async function speakWithGoogle(options: SpeakTextOptions): Promise<boolean> {
  if (!options.apiKey) return false

  try {
    const body = {
      input: { text: options.text },
      voice: {
        languageCode: 'en-US',
        name: options.googleVoiceName || 'en-US-Neural2-C',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: options.rate,
        pitch: (options.pitch - 1) * 8,
        volumeGainDb: (options.volume - 1) * 12,
      },
    }

    const response = await fetch(`${GOOGLE_ENDPOINT}?key=${encodeURIComponent(options.apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) return false
    const data = (await response.json()) as { audioContent?: string }
    if (!data.audioContent) return false

    const audioBlob = base64ToMp3Blob(data.audioContent)
    playBlobAudio(audioBlob, options.interrupt ?? true)
    return true
  } catch {
    return false
  }
}

let activeAudio: HTMLAudioElement | null = null

function playBlobAudio(blob: Blob, interrupt: boolean) {
  if (interrupt && activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }

  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  activeAudio = audio
  void audio.play().finally(() => {
    URL.revokeObjectURL(url)
    if (activeAudio === audio) {
      activeAudio = null
    }
  })
}

function base64ToMp3Blob(base64: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'audio/mpeg' })
}

function buildAzureSsml({
  text,
  voiceName,
  rate,
  pitch,
}: {
  text: string
  voiceName: string
  rate: number
  pitch: number
}) {
  const ratePct = Math.round((rate - 1) * 100)
  const pitchPct = Math.round((pitch - 1) * 100)
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<speak version="1.0" xml:lang="en-US"><voice name="${voiceName}"><prosody rate="${ratePct >= 0 ? '+' : ''}${ratePct}%" pitch="${pitchPct >= 0 ? '+' : ''}${pitchPct}%">${escaped}</prosody></voice></speak>`
}
