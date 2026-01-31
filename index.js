const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const { spawn } = require('child_process');
//const URL = 'https://learningcatalytics.pearson.com/class_sessions/31354357';
const URL = 'https://time.is/';

const PATH_TO_ALERT = path.join(__dirname, 'alert.mp3');
const DEFAULT_ALERT = '/System/Library/Sounds/Glass.aiff';


let currentSound = null;

function playSound() {
    const soundFile = fs.existsSync(PATH_TO_ALERT) ? PATH_TO_ALERT : DEFAULT_ALERT;
    currentSound = spawn('afplay', [soundFile], { stdio: 'ignore' });
    currentSound.on('exit', () => { currentSound = null; });
    console.log('Sound played! (Press 5 to stop current sound)');
}

async function scrape () {
    console.log('Starting browser... (Press 5 to stop current sound)');

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
        if (key?.ctrl && key.name === 'c') process.exit();
        if (str === '5' && currentSound) {
            currentSound.kill();
            console.log('Sound stopped.');
        }
    });

    const browser = await puppeteer.launch({ headless: false, ignoreDefaultArgs: [
        "--mute-audio",
    ],
    args: [
        "--autoplay-policy=no-user-gesture-required",
    ],});
    

    function mutationListener(oldTime, newValue) {
        console.log(`Time changed: ${oldTime} → ${newValue}`);
        playSound();
    }
    const PAGE = await browser.newPage();

    await PAGE.goto(URL, { waitUntil: 'domcontentloaded', timeout: 0 });
    console.log('Page loaded.');

    await PAGE.exposeFunction('listen', mutationListener);

    const found = await PAGE.evaluate(() => {
        const container = document.querySelector('#clock');
        if (!container) return false;
        let oldTime = container.innerText;
        const observer = new MutationObserver(() => {
            const curr = container.innerText;
            if (curr !== oldTime) {
                window.listen(oldTime, curr);
                oldTime = curr;
            }
        });
        observer.observe(container, {
            characterData: true,
            childList: true,
            subtree: true,
        });
        return true;
    });

    if (found) {
        console.log('Watching clock for changes...');
    } else {
        console.log('Element not found. Check the page selector.');
    }
}
scrape();