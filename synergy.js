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
  let xRunning = checkXRunning();
  let ipAddress = await getVirtualMachineIp(domain, bridge);
  let portOpen = false;
  if (!ipAddress) {
    //console.log('couldnt get ip');
  } else {
    //console.log('checking VMs synergy server');
    try {
      // use lsof here so as not to send any garbage to the synergy server unless we need to
      let stdout = spawnSync('lsof', ['-i', `:${port}`]).stdout.toString();
      if (stdout.includes(ipAddress)) {
        //console.log("a client is connected to the VM")
        portOpen = true
      } else {
        portOpen = /open/.test(execSync(`sudo nmap -sS -p ${port} ${ipAddress} | grep open`))
      }
    } catch(err) {
    }
  }

  if (portOpen) {
    if (!proxy) {
      if (synergy) {
        //console.log('killing internal synergy');
        synergy.kill('SIGTERM');
        synergy = null;
      } else {
        try {
          //console.log('killing external synergy');
          execSync('pkill synergy');
        } catch(err) {
        }
      }

      try {
        //console.log('killing external synergy server');
        execSync('pkill -SIGKILL synergys');
      } catch(err) {
      }

      //console.log('wait until port is released');
      await portRelease(port);

      //console.log('creating proxy');
      proxy = createProxy(port, ipAddress, port, {tls: false});

      if (xRunning) { 
        try {
          const sideBySide = /1720/.test(execSync(`xrandr | grep '*'`));
          if (sideBySide) {
            //console.log('side by side... creating client');

            try {
              //console.log('killing external synergy client');
              execSync('pkill -SIGKILL synergyc');
            } catch(err) {
            }
            client = spawn('synergyc', ['--enable-crypto', '-f', '--restart', ipAddress], { stdio: 'inherit', env: process.env });
            client.on('exit', ()=>client = null);
          } else if (client) {
            //console.log('no longer side by side, killing client');
            client.kill('SIGTERM');
            client = null;
            try {
              //console.log('killing external synergy client');
              execSync('pkill -SIGKILL synergyc');
            } catch(err) {
            }
          }
        } catch(err) {
        }
      }
    }
  } else {
    //console.log('VMs synergy is off');
    if (synergy) {
      //console.log('synergy already running, doing nothing');
    } else {
      if (proxy) {
        //console.log('killing proxy');
        proxy.end();
        proxy = null;
      }

      if (xRunning) {
        //console.log('wait until port is released');
        await portRelease(port);

        //console.log('spawning synergy');
        synergy = spawn('synergys', ['-f', '--enable-crypto'], { stdio: "inherit", env: process.env });
        synergy.on('exit', ()=>synergy = null);
      }
    }

    if (client) {
      //console.log('killing client');
      client.kill('SIGTERM');
      client = null;
      try {
        //console.log('killing external synergy client');
        execSync('pkill -SIGKILL synergyc');
      } catch(err) {
      }
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

function checkXRunning() {
  return spawnSync('xprop', ['-root']).status === 0;
}

loop();
