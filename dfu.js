


function dfu()
{
	setPackage(getFile("FW/app_dfu_package.zip"));

}

function getFile(url) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('get', url, true);
        xhr.responseType = 'document';
        xhr.onload = function () {
            var status = xhr.status;
            if (status == 200) {
                resolve(xhr.responseText);
            } else {
                reject(status);
            }
        };
        xhr.send();
    });
}

  function setStatus(state) {
            labelEl.textContent = state;
        }

        function setTransfer(state) {
            if (!state) {
                statusEl.style.visibility = "hidden";
                return;
            }
            selectEl.style.visibility = "hidden";
            statusEl.style.visibility = "visible";
            barEl.style.width = state.currentBytes / state.totalBytes * 100 + '%';
            transferEl.textContent = `${state.currentBytes}/${state.totalBytes} ${state.object} bytes written`;
        }

        // Load a firmware package
        function setPackage(file) {
            if (!file) return;

            package = new SecureDfuPackage(file);
            package.load()
            .then(() => {
                setStatus(`Firmware package: ${file.name}`);
                selectEl.style.visibility = "visible";
            })
            .catch(error => {
                selectEl.style.visibility = "hidden";
                statusEl.style.visibility = "hidden";
                setStatus(error);
            });
        }

        // Choose a device
        function selectDevice() {
            setStatus("Selecting device...");
            setTransfer();

            const dfu = new SecureDfu(CRC32.buf);
            dfu.addEventListener("log", event => {
                console.log(event.message);
            });
            dfu.addEventListener("progress", event => {
                setTransfer(event);
            });

            dfu.requestDevice(true)
            .then(device => {
                if (!device) {
                    setStatus("DFU mode set, select device again");
                    return;
                }
                return update(dfu, device);
            })
            .catch(error => {
                statusEl.style.visibility = "hidden";
                setStatus(error);
            });
        }

        // Update a device with all firmware from a package
        function update(dfu, device) {
            if (!package) return;

            Promise.resolve()
            .then(() => package.getBaseImage())
            .then(image => {
                if (image) {
                    setStatus(`Updating ${image.type}: ${image.imageFile}...`);
                    return dfu.update(device, image.initData, image.imageData);
                }
            })
            .then(() => package.getAppImage())
            .then(image => {
                if (image) {
                    setStatus(`Updating ${image.type}: ${image.imageFile}...`);
                    return dfu.update(device, image.initData, image.imageData);
                }
            })
            .then(() => {
                setStatus("Update complete!");
                setTransfer();
                fileEl.value = "";
            })
            .catch(error => {
                statusEl.style.visibility = "hidden";
                setStatus(error);
            });
        }
