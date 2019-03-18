if [[ -f $PWD/synergy.service ]]; then
  if [[ -e /etc/systemd/system/synergy.service ]]; then
    echo "service already installed"
  else
    sudo ln -s $PWD/synergy.service /etc/systemd/system/synergy.service
    echo "symlinked service from here to /etc/systemd/system/synergy.service"
    sudo systemctl daemon-reload
  fi
else
  echo "can't find the service file"
fi
