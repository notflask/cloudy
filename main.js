const { app, BrowserWindow, Menu } = require('electron')
const shortcuts = require("electron-localshortcut")
let win = null
Menu.setApplicationMenu(null);

const { Client } = require('discord-rpc')
const rpc = new Client({transport: "ipc"})
const clientId = "1217561130625536161"
rpc.login({ clientId }).catch(console.error);

const Store = require("electron-store")
const store = new Store()

const darkModeCss = require('./dark')


function shortenString(str) {
    return str.length > 128 ? str.substring(0, 128) + "..." : str;
}

function toggleDarkMode() {
    const isDarkMode = store.get("darkMode");
    store.set("darkMode", !isDarkMode);
    if (win) {
      win.reload();
    }
}

const createWindow = async () => {
    win = new BrowserWindow({
        width: 1250,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
        },
    })

    win.setBounds(store.get("windowBounds"))
    win.loadURL("https://soundcloud.com/discover")

    win.webContents.on("did-finish-load", async () => {
        await win.webContents.insertCSS(`
        html, body { 
            overflow: auto !important;
            scrollbar-width: none;
        }

        ::-webkit-scrollbar-track {
            background-color: transparent;
          }
        `)

        if (store.get("darkMode")) {
            await win.webContents.insertCSS(darkModeCss)
        }

        setInterval(async() => {
            const isPlaying = await win.webContents.executeJavaScript(
                `document.querySelector('.playControls__play').classList.contains('playing')`,
            );

            if (isPlaying) {
                const track = await win.webContents.executeJavaScript(`
                new Promise(resolve => {
                  const title = document.querySelector('.playbackSoundBadge__titleLink');
                  const author = document.querySelector('.playbackSoundBadge__lightLink');
                  if (title && author) {
                    resolve({title: title.innerText, author: author.innerText});
                  } else {
                    resolve({title: '', author: ''});
                  }
                });
                `)

                const thumbnailUrl = await win.webContents.executeJavaScript(`
                    new Promise(resolve => {
                    const thumbnail = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
                    if (thumbnail) {
                        const url = thumbnail.style.backgroundImage.replace('url("', '').replace('")', '');
                        resolve(url);
                    } else {
                        resolve('');
                    }
                    });
                `)

                const trackTitle = track.title
                    .replace(/\n.*/s, "")
                    .replace("Current track:", "")
                const trackAuthor = track.author
                
                rpc.setActivity(
                    {
                        details: shortenString(trackTitle),
                        state: `by ${shortenString(trackAuthor)}`,
                        largeImageKey: thumbnailUrl.replace("50x50.", "500x500."),
                        largeImageText: trackTitle,
                        smallImageKey: "soundcloud-logo",
                        smallImageText: "SoundCloud",
                        instance: false,
                    }
                );
            }
        }, 2 * 1000)
    })

    win.on("close", () => {
        store.set("windowBounds", win.getBounds());
    })

    win.on("closed", () => {
        win = null;
    })

    shortcuts.register(win, "F1", () => toggleDarkMode())
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
    app.quit();
})

app.on("activate", () => {
    if (win === null) {
      createWindow();
    }
})