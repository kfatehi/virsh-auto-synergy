const fs = require('fs');
const { execSync, spawnSync, spawn } = require('child_process');
const createProxy = require('node-tcp-proxy').createProxy;
const parseXML = require('xml2js').parseString;
const port = "24800";
const domain = 'win10';
const bridge = 'virbr0';

let client;
let proxy; 
let synergy;

async function loop() {
  let ipAddress = await getVirtualMachineIp(domain, bridge);
  if (!ipAddress) {
    console.log('couldnt get ip');
    setTimeout(loop, 10000);
    return;
  }

  console.log('checking VMs synergy server');
  let portOpen = false;
  try {
    portOpen = /open/.test(execSync(`sudo nmap -sS -p ${port} ${ipAddress} | grep open`))
  } catch(err) {
  }
  if (portOpen) {
    if (proxy) {
      console.log('proxy is already on. doing nothing');
    } else {
      if (synergy) {
        console.log('killing internal synergy');
        synergy.kill('SIGTERM');
        synergy = null;
      } else {
        try {
          console.log('killing external synergy');
          execSync('pkill synergy');
        } catch(err) {
        }
      }

      try {
        console.log('killing external synergy server');
        execSync('pkill -SIGKILL synergys');
      } catch(err) {
      }

      console.log('wait until port is released');
      await portRelease(port);

      console.log('creating proxy');
      proxy = createProxy(port, ipAddress, port, {tls: false});

    }

    const sideBySide = /1720/.test(execSync(`xrandr | grep '*'`));
    if (sideBySide) {
      console.log('side by side... creating client');
      client = spawn('synergyc', ['--enable-crypto', '-f', '--restart', ipAddress], { stdio: 'inherit', env: process.env });
    } else if (client) {
      console.log('no longer side by side, killing client');
      client.kill('SIGTERM');
      client = null;
    }
  } else {
    console.log('VMs synergy is off');
    if (synergy) {
      console.log('synergy already running, doing nothing');
    } else {
      if (proxy) {
        console.log('killing proxy');
        proxy.end();
        proxy = null;
      }

      console.log('wait until port is released');
      await portRelease(port);

      console.log('spawning synergy');
      synergy = spawn('synergys', ['-f', '--enable-crypto'], { stdio: "inherit", env: process.env });
    }

    if (client) {
      console.log('killing client');
      client.kill('SIGTERM');
      client = null;
    }
  }

  setTimeout(loop, 10000);
}

async function getVirtualMachineIp(domain, bridge) {
  return new Promise((resolve, reject) => {
    parseXML(execSync(`virsh --connect qemu:///system dumpxml ${domain}`), (err, vmData)=>{
      if (err)
        return resolve();
      try {
        const macAddress = vmData.domain.devices[0].interface[0].mac[0]['$'].address;
        resolve(JSON.parse(fs.readFileSync(`/var/lib/libvirt/dnsmasq/${bridge}.status`).toString()).find(i=>i['mac-address']===macAddress)['ip-address']);
      } catch(err) {
        return resolve();
      }
    });
  });
}

async function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

async function portRelease(port) {
  let status = 0;
  while (status === 0) {
    let out = spawnSync('nc', ['-zvw1', 'localhost', port]);
    await delay(1000);
    status = out.status;
  }
}

loop();
