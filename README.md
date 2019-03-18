# virsh-auto-synergy

this script checks if the named vm is listening for synergy clients.

it does some cool orchestration based on that and some other things.

the main prompt to write this is that i have a VM in which I pass through the GPU, keyboard, and mouse.

I have a mac on the right side of the monitor that should connect regardless of what the display is showing.

my display can also do linux & the VM side by side, so i like for it to detect that too and connect as a client in that case.

when the VM is offline, the linux machine should be the server.

works great :)
