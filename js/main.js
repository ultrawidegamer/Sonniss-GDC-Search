const AllTracklists = [];
const FilteredTracklists = [];
const searchInput = document.querySelector(".search > input");
const contentHolder = document.querySelector(".content");
const audioWrapper = document.querySelector(".audio"); 
const audioPlayer = document.querySelector(".playback > audio");
const audioWaveform = document.querySelector(".waveform");
const waveformCanvas = document.querySelector(".waveform > canvas");
const downloadButton = document.querySelector(".download");
const titleButton = document.querySelector(".titlebar > .title");
const scroller = createInfiniteScroller(contentHolder);
const audioContext = new AudioContext();
const waveformStore = {};
const audioUrlStore = {};
let currentWaveform;
let lastProgress = 0;
let lastPlaystate;
let resumeTime = 0;
let seeking = false;
let hasSeeked = false;

const debounce = (func, delay) => {
    let timer;

    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, delay);
    };
}

titleButton.addEventListener("click", scrollToTop);
searchInput.addEventListener("input", debounce(searchTracklists, 500));
audioPlayer.addEventListener("play", () => playAudio(lastPlaystate));
audioPlayer.addEventListener("pause", () => pauseAudio(lastPlaystate));
audioPlayer.addEventListener("loadeddata", () => startAudio());
audioPlayer.addEventListener("ended", () => stopAudio(lastPlaystate));
waveformCanvas.addEventListener("pointerdown", startSeek);
waveformCanvas.addEventListener("pointermove", seekAudio);
waveformCanvas.addEventListener("pointerup", endSeek);
waveformCanvas.addEventListener("click", e => {
    if (hasSeeked) {
        hasSeeked = false;
        return;
    }

    startSeek(e);
    seekAudio(e);
    endSeek(e);
});

function searchTracklists() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const terms = searchTerm.match(/"[^"]+"|\S+/g)
        ?.filter(data => Boolean(data) && data !== "-") ?? [];

    FilteredTracklists.length = 0;
    scroller.clear();

    AllTracklists.forEach(({year, csvArr}) => {
        const arr = csvArr.filter(track => {
            const tags = track[track.length-1].toLowerCase();
            return terms.every(term => {
                const negated = term.startsWith("-");
                term = negated ? term.slice(1, Infinity) : term;
                const quoted = term.startsWith("\"") && term.endsWith("\"");
                term = quoted ? term.slice(1, -1).replaceAll(" ", "|") : term;                
                const hasTag = tags.includes(term);

                return negated ? !hasTag : hasTag;
            });
        });
        const updated = { year, csvArr: arr }

        FilteredTracklists.push(updated);
        addTracklist(updated);
    });
}

function downloadTracklist(year) {
    return fetch(`./tracklists/${year}.csv`)
        .then(response => response.text())
        .then(data => parseCsv(year, data));
}

function parseCsv(year, data) {
    const rows = data.split("\n");
    const headers = rows.shift().split(",");
    const csvArr = rows.map(row => {
        return row
            .replace(/"([^"]*)"/g, (_, value) => `${value.replaceAll(",", "<COMMA>")}`)
            .split(',')
            .map(data => data.replaceAll("<COMMA>"  , ",").trim());
    });

    return { year, csvArr }
}

Promise.all([
    downloadTracklist(2026),
    downloadTracklist(2024),
    downloadTracklist(2023),
    downloadTracklist(2020),
    downloadTracklist(2019),
    downloadTracklist(2018),
    downloadTracklist(2017),
    downloadTracklist(2016),
    downloadTracklist(2015)
]).then(tracklists => {
    tracklists.forEach(addAllTracklist);
}).catch(err => {
    console.error(err);
});

function addAllTracklist(data) {
    AllTracklists.push(data);
    FilteredTracklists.push(data);
    addTracklist(data);
}

function addTracklist(data) {
    data.csvArr.forEach(item => addTrackToScroller(data.year, item));
}

function addTrackToScroller(year, data) {
    const item = createScrollItem(year, data);
    scroller.append(item)
}

function createScrollItem(year, data) {
    const item = document.createElement('div');
    const baseUrl = `https://archive.org/download/sonniss-gdc-${year}-game-audio-bundle-normalized`;
    const urlNoExtension = baseUrl + encodeURIComponent(data[data.length-2])
        .replaceAll("%2F", "/")
        .slice(0, -4);
    
    item.classList.add('item')
    item.innerHTML = `
        <div class="playstate">
            <div class="playbutton"></div>
            <div class="pausebutton"></div>
            <div class="loadingspinner"></div>
        </div>
        <div class="trackname">
            <div class="text">${cleanTitle(data[0])}</div>
        </div>
        <div class="tracklibrary">
            <div class="text">${data[1]}</div>
        </div>
        <div class="trackcreator">
            <div class="text">${data[2]}</div>
        </div>
    `

    item.addEventListener("click", () => {
        const state = item.querySelector(".playstate");

        if (lastPlaystate === state) {
            if (audioPlayer.paused) {
                audioPlayer.play()
            } else { 
                audioPlayer.pause()
            }
        } else {
            generateWaveformAndPlay(state, urlNoExtension);
        }  
    })
    
    return item
}

function startAudio() {
    resumeTime = 0;

    audioPlayer.play()
        .catch(error => {
            if (error.name === "AbortError") return;
            console.error(error);
        });
    
    updateWaveformProgress()
}

function playAudio(state) {
    audioPlayer.currentTime = resumeTime;
    audioWrapper.classList.add("playing")

    updateWaveformProgress()

    if (state === undefined) return;

    state.classList.remove("loading");
    state.classList.add("playing");
    
}

function pauseAudio(state) {
    resumeTime = audioPlayer.currentTime;

    if (state === undefined) return;

    state.classList.remove("playing");
    state.classList.remove("loading");
}

function stopAudio(state) {
    if (state !== undefined) {
        state.classList.remove("playing");
        state.classList.remove("loading");
    }
    
    audioWrapper.classList.remove("playing")
    audioPlayer.src = "";
    lastPlaystate = undefined;
}

function startSeek(e) {
    hasSeeked = false;
    seeking = true;
    waveformCanvas.setPointerCapture(e.pointerId)
}

function seekAudio (e) {
    if (!seeking || !audioPlayer?.duration) return;

    hasSeeked = true;

    resumeTime = audioPlayer.duration * (e.offsetX / waveformCanvas.clientWidth);
    resumeTime = Math.min(resumeTime, audioPlayer.duration);
    resumeTime = Math.max(resumeTime, 0);

    audioPlayer.currentTime = resumeTime;

    if (audioPlayer.paused) {
        updateProgressVisual(resumeTime / audioPlayer.duration);
    }
}

function endSeek(e) {
    seeking = false;
    if (waveformCanvas.hasPointerCapture(e.pointerId)) {
        waveformCanvas.releasePointerCapture(e.pointerId);
    }
}

function generateWaveformAndPlay(state, urlNoExtension) {
    const audioUrl = `${urlNoExtension}.mp3`;

    if (lastPlaystate !== undefined) {
        stopAudio(lastPlaystate);
    }

    lastPlaystate = state;
    state.classList.add("loading");

    fetchWaveformData(urlNoExtension)
        .then(waveform => {
            const cachedUrl = getCachedAudioUrl(audioUrl);

            currentWaveform = waveform;
            drawWaveform(waveform, waveformCanvas, 0);
       
            audioWrapper.classList.add("played");
            audioPlayer.src = cachedUrl;
            downloadButton.href = cachedUrl;
        })
        .catch(error => {
            stopAudio(lastPlaystate);
        })
}

function addUrlToCache(audioUrl, data) {
    audioUrlStore[audioUrl] = data.url
    return data;
}

function getCachedAudioUrl(audioUrl) {
    return audioUrlStore[audioUrl] ?? audioUrl;
}

function fetchWaveformData(urlNoExtension) {
    if (waveformStore[urlNoExtension] !== undefined) { 
        return Promise.resolve(waveformStore[urlNoExtension])
    }

    const audioUrl = `${urlNoExtension}.mp3`;
    const cachedUrl = getCachedAudioUrl(audioUrl);

    return fetch(cachedUrl)
        .then(data => addUrlToCache(audioUrl, data))
        .then(data => data.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(decoded => generateWaveform(urlNoExtension, decoded))
        .catch(error => {
            stopAudio(lastPlaystate);
        })
}

function generateWaveform(id, data) {
    const channelData = data.getChannelData(0);
    const samples = 200;
    const blockSize = Math.floor(channelData.length / samples);
    const waveform = [];

    for (let i = 0; i < samples; i++) {
        let sum = 0;

        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
        }

        waveform.push(sum / blockSize);
    }

    const max = Math.max(...waveform);
    const normalizedWaveform = waveform.map(value => value / max);

    waveformStore[id] = normalizedWaveform;
    return normalizedWaveform;
}

function drawWaveform(waveform, canvas, progress = 0) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);

    drawWaveformPart(waveform, ctx, width, height, "hsl(0deg 0% 50%)");

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width * progress, height);
    ctx.clip();

    drawWaveformPart(waveform, ctx, width, height, "hsl(250 100% 62% / 1)");

    ctx.restore();
}

function drawWaveformPart(waveform, ctx, width, height, color) {
    const centerY = height / 2;

    ctx.strokeStyle = color;
    ctx.beginPath();

    waveform.forEach((value, index) => {
        const x = (index / (waveform.length - 1)) * width;
        const amplitude = value * height;

        ctx.moveTo(x, centerY - amplitude / 2);
        ctx.lineTo(x, centerY + amplitude / 2);
    });

    ctx.stroke();
}

function updateProgressVisual(progress) {
    drawWaveform(currentWaveform, waveformCanvas, progress);
    lastProgress = progress;
    audioWaveform.style.setProperty('--progress', `${progress*100}%`);
}

function updateWaveformProgress() {
    const progress = audioPlayer.currentTime / audioPlayer.duration;

    if (Math.abs(progress - lastProgress) > 0.002) {
        updateProgressVisual(progress)
    }

    if (!audioPlayer.paused && !audioPlayer.ended) {
        requestAnimationFrame(updateWaveformProgress);
    }
}

function cleanTitle(title) {
    return title
        .slice(0, -4)
        .replace(/[_\-./\\]+/g, " ")
}

function scrollToTop() {
    contentHolder.firstChild.scrollIntoView();

    if (contentHolder.firstChild.nextSibling.hidden) {
        setTimeout(scrollToTop, 50);
    }
}

function createInfiniteScroller(scrollEl, chunkSize = 200) {
    const top = document.createElement('div');
    const chunk = document.createElement('div');
    const bottom = document.createElement('div');
    let clearing = false;

    top.classList.add('sentinel-top');
    chunk.classList.add('chunk');
    bottom.classList.add('sentinel-bottom');

    chunk.dataset.active = true;

    scrollEl.appendChild(top);
    scrollEl.appendChild(chunk);
    scrollEl.appendChild(bottom);

    let observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || clearing) return;

            const active = scrollEl.querySelector('[data-active=true]');
            const previous = active.previousElementSibling;
            const next = active.nextElementSibling;

            if (entry.target.classList.contains('sentinel-top')) {
                if (!previous.previousElementSibling || !previous.previousElementSibling.hidden) return;
                previous.previousElementSibling.hidden = false;
                previous.dataset.active = true;
                active.dataset.active = false;
                if (active.classList.contains('chunk')) {
                    active.hidden = true;
                }
                previous.scrollIntoView();
            } else {
                if (!next.hidden) return;
                next.hidden = false;
                next.dataset.active = true;
                active.dataset.active = false;
                if (active.previousElementSibling.classList.contains('chunk')) {
                    active.previousElementSibling.hidden = true;
                }
                next.scrollIntoView();
            }
        })
    })

    observer.observe(top);
    observer.observe(bottom);

    return {
        append: (el) => {
            const lastChunk = bottom.previousElementSibling;

            if (lastChunk.childElementCount < chunkSize) {
                lastChunk.appendChild(el);
            } else {
                const chunk = document.createElement('div');

                chunk.classList.add('chunk');
                chunk.appendChild(el);
                chunk.hidden = true;

                lastChunk.after(chunk);
            }
        },
        clear: () => {
            clearing = true;
            while (bottom.previousElementSibling.previousElementSibling !== top) {
                scrollEl.removeChild(bottom.previousElementSibling);
            }
            while (bottom.previousElementSibling.firstChild) {
                bottom.previousElementSibling.removeChild(bottom.previousElementSibling.lastChild);
            }
            bottom.previousElementSibling.dataset.active = true;
            bottom.previousElementSibling.hidden = false;
            top.scrollIntoView();
            clearing = false;
        }
    }
}
