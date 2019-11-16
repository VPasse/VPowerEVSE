var bluetoothDevice;

const evseDFUServiceUUID = '0000fe59-0000-1000-8000-00805f9b34fb';
const evseDFUCharUUID = '8ec90003-f315-4f60-9fb8-838830daea50';

const evseServiceUUID = 'e2db0001-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evseUcharUUID = 'e2db0002-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evseIcharUUID = 'e2db0003-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evsePcharUUID = 'e2db0004-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evseEcharUUID = 'e2db0005-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evseScharUUID = 'e2db0006-bd2e-11e9-9cb5-2a2ae2dbcce4';
const evseCcharUUID = 'e2db0007-bd2e-11e9-9cb5-2a2ae2dbcce4';

var charDfu;

var charC;
var charS;

var stateNames = ["Booting", "Fault", "Waiting for car", "Car connected", "Charging", "Aborting"];

var voltages = [0, 0, 0, 0];
var currents = [0, 0, 0];
var power = [0, 0, 0];
var state = 0;
var energyTotal = 0;
var energySession = 0;
var maxCurrent = 0;
var alwaysBootAt6A = false;

function loaded() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('/service-worker.js')
		.then(function (registration) {
			console.log('Registration successful, scope is:', registration.scope);
		})
		.catch (function (error) {
			console.log('Service worker registration failed, error:', error);
		});
	}
}

function connected() {
	document.getElementById('status').innerHTML = 'Connected';
	document.getElementById('ButtonConnect').style.display = 'none';
}

function disconnected() {
	document.getElementById('status').innerHTML = 'Not connected';
	document.getElementById('ButtonConnect').style.display = 'inline-block';
}

function onDisconnected() {
	disconnected();
	ble_connect()
}

async function ble_connect() {
	try {
		document.getElementById('ButtonConnect').style.display = 'none';
		document.getElementById('status').innerHTML = 'Connecting...';
		bluetoothDevice = null;

		let options = {
			filters: [{
					name: 'VPower'
				}, {
					services: [evseServiceUUID, evseDFUServiceUUID]
				}
			],
			optionalServices: [evseServiceUUID, evseDFUServiceUUID]
		};
		bluetoothDevice = await navigator.bluetooth.requestDevice(options);
		bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
		const server = await bluetoothDevice.gatt.connect();
		const service = await server.getPrimaryService(evseServiceUUID);

		const serviceDfu = await server.getPrimaryService(evseDFUServiceUUID);
		charDfu = await serviceDfu.getCharacteristic(evseDFUCharUUID);
		await charDfu.startNotifications()
		charDfu.addEventListener('characteristicvaluechanged', handleNotifications);


		const charU = await service.getCharacteristic(evseUcharUUID);
		await charU.startNotifications()
		charU.addEventListener('characteristicvaluechanged', handleNotifications);

		const charI = await service.getCharacteristic(evseIcharUUID);
		await charI.startNotifications()
		charI.addEventListener('characteristicvaluechanged', handleNotifications);

		const charP = await service.getCharacteristic(evsePcharUUID);
		await charP.startNotifications()
		charP.addEventListener('characteristicvaluechanged', handleNotifications);

		const charE = await service.getCharacteristic(evseEcharUUID);
		await charE.startNotifications()
		charE.addEventListener('characteristicvaluechanged', handleNotifications);

		charS = await service.getCharacteristic(evseScharUUID);
		await charS.startNotifications()
		charS.addEventListener('characteristicvaluechanged', handleNotifications);

		charC = await service.getCharacteristic(evseCcharUUID);
		await charC.startNotifications()
		charC.addEventListener('characteristicvaluechanged', handleNotifications);
		connected();
	} catch (error) {
		disconnected();
	}
}

function handleNotifications(event) {
	let value = event.target.value;
	let characteristic = event.target.uuid;
	switch (characteristic) {
	case evseUcharUUID:
		voltages[0] = value.getUint16(0, true) / 100;
		voltages[1] = value.getUint16(2, true) / 100;
		voltages[2] = value.getUint16(4, true) / 100;
		voltages[3] = value.getUint16(6, true) / 100;
		break;
	case evseIcharUUID:
		currents[0] = value.getUint16(0, true) / 1000;
		currents[1] = value.getUint16(2, true) / 1000;
		currents[2] = value.getUint16(4, true) / 1000;
		break;
	case evsePcharUUID:
		power[0] = value.getUint16(0, true);
		power[1] = value.getUint16(2, true);
		power[2] = value.getUint16(4, true);
		break;
	case evseEcharUUID:
		energyTotal = value.getUint32(0, true) / 100;
		energySession = value.getUint16(4, true) / 100;
		break;
	case evseScharUUID:
		state = value.getUint8(0, true);
		document.getElementById('status').innerHTML = stateNames[state];
		break;
	case evseCcharUUID:
		maxCurrent = value.getUint8(0, true);
		alwaysBootAt6A = value.getUint8(1, true);
		break;
	}
	ble_refresh_data();
}

async function update_current() {
	let buffer = new ArrayBuffer(2);
	let uint8View = new Uint8Array(buffer);
	uint8View[0] = document.querySelector('input[name="currentSetting"]:checked').value;
	uint8View[1] = document.querySelector('input[name="currentSettingMemory"]:checked').value;
	await charC.writeValue(uint8View);
}

async function stop_charging() {
	let buffer = new ArrayBuffer(1);
	let uint8View = new Uint8Array(buffer);
	uint8View[0] = 5;
	await charS.writeValue(uint8View);
}

function ble_refresh_data() {
	document.getElementById("L1").innerHTML = "L1: " + voltages[0].toFixed(0).toString() + "V, " + currents[0].toFixed(1).toString() + "A, " + (power[0] / 1e3).toFixed(1).toString() + "kW"
		document.getElementById("L2").innerHTML = "L2: " + voltages[1].toFixed(0).toString() + "V, " + currents[1].toFixed(1).toString() + "A, " + (power[1] / 1e3).toFixed(1).toString() + "kW"
		document.getElementById("L3").innerHTML = "L3: " + voltages[2].toFixed(0).toString() + "V, " + currents[2].toFixed(1).toString() + "A, " + (power[2] / 1e3).toFixed(1).toString() + "kW"
		document.getElementById("N").innerHTML = "N: " + voltages[3].toFixed(0).toString() + "V"
		document.getElementById("EnergySess").innerHTML = "Session: " + (energySession / 1e3).toFixed(1).toString() + "kWh"
		document.getElementById("EnergyTot").innerHTML = "Total: " + (energyTotal / 1e3).toFixed(1).toString() + "kWh"
		document.getElementById("State").innerHTML = stateNames[state]
		if (state == 4) //charging
		{
			document.getElementById('ButtonStopCharging').style.display = 'inline-block';
		} else {
			document.getElementById('ButtonStopCharging').style.display = 'none';
		}

		if (maxCurrent == 6) {
			document.getElementById("6A").checked = true;
		} else {
			document.getElementById("6A").checked = false;
		}
		if (maxCurrent == 10) {
			document.getElementById("10A").checked = true;
		} else {
			document.getElementById("10A").checked = false;
		}
		if (maxCurrent == 13) {
			document.getElementById("13A").checked = true;
		} else {
			document.getElementById("13A").checked = false;
		}
		if (maxCurrent == 16) {
			document.getElementById("16A").checked = true;
		} else {
			document.getElementById("16A").checked = false;
		}
		if (alwaysBootAt6A == 1) {
			document.getElementById("forget").checked = true;
			document.getElementById("retain").checked = false;
		} else {
			document.getElementById("forget").checked = false;
			document.getElementById("retain").checked = true;
		}

}
