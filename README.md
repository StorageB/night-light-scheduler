# Night Light Scheduler

#### A GNOME Shell extension for creating a custom time-of-day schedule for GNOME's built-in Night Light.

![screenshot-main](img/screenshot-02.png)

## Features

- Create a custom Night Light schedule to change color temperatures throughout the day
- Smoothly transition between temperatures with an adjustable transition time
- Export and import schedule configuration as an editable .ini file
- Uses GNOME's built-in Night Light functionality

## Installation

### Recommended

Browse for and install this extension through the [GNOME Extension Manager](https://mattjakeman.com/apps/extension-manager) app or the [GNOME Extensions website](https://extensions.gnome.org/extension/9683/night-light-scheduler/).

### Manual

1. Download the `night-light-scheduler.zip` file of the [latest release](https://github.com/StorageB/night-light-scheduler/releases). 
2. In the terminal from the download location run:
`gnome-extensions install --force night-light-scheduler.zip`
3. Logout and login.
4. Enable and configure the extension by running:
```
gnome-extensions enable night-light-scheduler@storageb.github.com
gnome-extensions prefs night-light-scheduler@storageb.github.com
```

## Initial Setup

The GNOME Night Light must always be enabled for this extension to work:
1. Turn on Night Light in GNOME Settings.
2. Select "Manual Schedule", and set Night Light to be always active (midnight to midnight).

## Configuration

Configure your custom schedule through the extension preferences interface.

### Scheduling

1. Adjust the time and color temperature for each schedule entry.
    - Use the `<` and `>` buttons to adjust the time
    - Use the slider to adjust the color temperature
    - Use the `-` and `+` buttons to remove or add schedule entries 

![schedule-row](img/schedule-row.png)

2. Adjust the transition time to gradually transition between scheduled color temperatures.

![transition-row](img/transition-row.png)


### Backup and Restore

Use the Export and Import buttons in the Configuration tab to save or load an editable schedule.ini file. Exported files are saved to your home directory and can be viewed or modified with any text editor.

Example `schedule.ini` entry:
```
[schedule]
transition-time=20
0:00=2400
6:00=3150
7:30=3900
9:00=4700
18:45=3900
21:00=3150
23:00=2400
```
