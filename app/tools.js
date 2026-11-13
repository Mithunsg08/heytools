/* HeyTools registry. To add a tool: add a line to HEY_TOOLS (and the folder to ../heytools-sw.js).
   net:  'offline' | 'partial' | 'online'
   perm: 'video' | 'audio' | 'camera' | 'mic' | 'motion'  -> permission screen before the tool opens
   hide: CSS that hides the page text / SEO sections when the tool runs inside the app. */
window.HEY_CATS = [
  { id: 'media',    label: 'Media' },
  { id: 'image',    label: 'Image & PDF' },
  { id: 'daily',    label: 'Daily life' },
  { id: 'utility',  label: 'Utilities' },
  { id: 'dev',      label: 'Developer & Design' },
  { id: 'games',    label: 'Games' },
  { id: 'business', label: 'Business' }
];
window.HEY_TOOLS = [
  { id: 'video-player', name: 'Video Player', cat: 'media', icon: '▶️', net: 'partial', perm: 'video', netNote: 'Videos on your phone work offline. Live TV and streaming need internet.', desc: 'Plays every video on your phone, live TV and streaming links.', hide: '.seo,footer' },
  { id: 'music-player', name: 'Music Player', cat: 'media', icon: '🎵', net: 'partial', perm: 'audio', netNote: 'Music on your phone works offline. Streaming needs internet.', desc: '3D player for all the music on your phone, plus streaming.', hide: '#about,footer' },
  { id: 'recorder', name: 'Recorder', cat: 'media', icon: '🎙️', net: 'offline', perm: 'mic', desc: 'Record voice, video or your screen. Saved on your device.', hide: 'article.seo,footer' },
  { id: 'emulsion', name: 'Emulsion', cat: 'media', icon: '🎞️', net: 'offline', desc: 'Image and video editor with layers and a timeline.', hide: '.hero,#features,#compare,#guides,#shortcuts,#faq,footer' },
  { id: 'video-loop', name: 'Video Loop', cat: 'media', icon: '🔁', net: 'offline', desc: 'Turn short clips into seamless long loops.', hide: 'footer' },
  { id: 'media-downloads', name: 'Media Downloads', cat: 'media', icon: '⬇️', net: 'online', desc: 'Download public media from a link.', hide: '#features,#faq,footer' },

  { id: 'image-compress', name: 'Image Compressor', cat: 'image', icon: '🗜️', net: 'offline', desc: 'Shrink images to a size you choose.', hide: '.hero,main>section.c,.cta,footer' },
  { id: 'image-to-pdf-converter', name: 'Image to PDF', cat: 'image', icon: '📄', net: 'offline', desc: 'Combine images into one PDF.', hide: '.feat,#formats,.seo,footer' },
  { id: 'background-removal', name: 'Background Removal', cat: 'image', icon: '✂️', net: 'partial', netNote: 'The AI model downloads on first use. After that it can work offline.', desc: 'Remove photo backgrounds without uploading.', hide: '.hero,#how,main>section.c,footer' },
  { id: 'barcode-generate', name: 'Barcode & QR Maker', cat: 'image', icon: '🏷️', net: 'offline', desc: 'Make barcodes and QR codes as PNG or SVG.', hide: '#formats,#how,#faq,footer' },

  { id: 'expense-tracker', name: 'Expense Tracker', cat: 'daily', icon: '💸', net: 'offline', isNew: true, desc: 'Log spending, see it by category, track a monthly budget.', hide: '.seo,footer,.lead' },
  { id: 'habit-tracker', name: 'Habit Tracker', cat: 'daily', icon: '✅', net: 'offline', isNew: true, desc: 'One-tap daily check-ins with streaks.', hide: '.seo,footer,.lead' },
  { id: 'focus-timer', name: 'Focus Timer', cat: 'daily', icon: '⏱️', net: 'offline', isNew: true, desc: 'Pomodoro work and break sessions with a chime.', hide: '.seo,footer,.lead' },
  { id: 'notes-to-do-list', name: 'Notes & To Do', cat: 'daily', icon: '📝', net: 'offline', desc: 'Pinned notes and daily tasks with reminders.', hide: '.about' },
  { id: 'world-clock', name: 'World Clock & Stopwatch', cat: 'daily', icon: '🌐', net: 'offline', desc: 'Times in 400+ zones and a lap stopwatch.', hide: 'main>section:not(#pw):not(#ps),footer' },

  { id: 'calculator', name: 'Calculator Suite', cat: 'utility', icon: '🧮', net: 'offline', desc: 'EMI, GST, tip, fuel, BMI, age and more.', hide: '.hero,.seo,footer' },
  { id: 'scientific-calculator', name: 'Scientific Calculator', cat: 'utility', icon: '📐', net: 'offline', desc: 'Trigonometry, logs and complex numbers.', hide: 'main>article,footer' },
  { id: 'unit-converter', name: 'Unit Converter', cat: 'utility', icon: '⚖️', net: 'offline', desc: 'Length, weight, temperature, volume, data and more.', hide: '.seo,footer,.lead' },
  { id: 'word-counter', name: 'Word Counter', cat: 'utility', icon: '🔠', net: 'offline', desc: 'Words, characters, reading time as you type.', hide: '.hero,section.info,footer' },
  { id: 'password-generator', name: 'Password Generator', cat: 'utility', icon: '🔐', net: 'offline', desc: 'Strong passwords, passphrases and PINs.', hide: 'main>section:nth-of-type(n+2),main>footer' },
  { id: 'qr-scanner', name: 'QR & Barcode Scanner', cat: 'utility', icon: '📷', net: 'offline', perm: 'camera', isNew: true, desc: 'Scan codes with your camera. Nothing is uploaded.', hide: '.seo,footer,.lead' },
  { id: 'compass', name: 'Compass', cat: 'utility', icon: '🧭', net: 'offline', perm: 'motion', desc: 'Heading, cardinal points and bearing to a place.', hide: 'section.info,footer' },
  { id: 'spirit-level', name: 'Spirit Level', cat: 'utility', icon: '📏', net: 'offline', perm: 'motion', desc: 'Bubble level and angle meter.', hide: '.seo,footer,.lead' },
  { id: 'internet-speed', name: 'Internet Speed', cat: 'utility', icon: '⚡', net: 'online', desc: 'Download, upload, ping and jitter.', hide: '.hero,#features,#guide,#faq,footer' },
  { id: 'earth-zipcode', name: "Earth's Zipcode", cat: 'utility', icon: '🌍', net: 'online', desc: '3D postal and PIN code finder.', hide: 'footer' },

  { id: 'json-formatter', name: 'JSON Formatter', cat: 'dev', icon: '🧾', net: 'offline', isNew: true, desc: 'Format, validate and minify JSON.', hide: '.seo,footer,.lead' },
  { id: 'color-picker', name: 'Color Picker', cat: 'dev', icon: '🎨', net: 'offline', isNew: true, desc: 'HEX, RGB, HSL, palettes and contrast.', hide: '.seo,footer,.lead' },

  { id: 'cyber-rush', name: 'Cyber Rush', cat: 'games', icon: '🎮', net: 'offline', desc: '3D cyberpunk endless runner.', hide: '#about,footer' },
  { id: 'dice-roller', name: 'Dice Roller', cat: 'games', icon: '🎲', net: 'offline', desc: 'Realistic 3D dice with five game modes.', hide: 'section.info,.sub,footer' },

  { id: 'opsreveal', name: 'OpsReveal', cat: 'business', icon: '🔍', net: 'online', external: 'https://opsreveal.preventloss.org/', desc: 'Retail loss prevention audits. Opens its own site.' }
];
