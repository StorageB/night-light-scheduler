/* extension.js
 *
 * This file is part of the Night Light Scheduler GNOME Shell extension
 * https://github.com/StorageB/night-light-scheduler
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { getTempAtTime, getNextWakeSeconds } from "./scheduleUtils.js";

export default class NightLightScheduler extends Extension {
    enable() {
        this._extensionSettings = this.getSettings();
        this._colorSettings = new Gio.Settings({
            schema: "org.gnome.settings-daemon.plugins.color",
        });

        this._scheduleChangedId = this._extensionSettings.connect(
            "changed::schedule",
            () => {
                this._scheduleNext();
            },
        );

        this._transitionChangedId = this._extensionSettings.connect(
                "changed::transition-time",
                () => {
                    this._scheduleNext();
                },
            );

        this._scheduleNext();
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._scheduleChangedId) {
            this._extensionSettings.disconnect(this._scheduleChangedId);
            this._scheduleChangedId = null;
        }

        if (this._transitionChangedId) {
            this._extensionSettings.disconnect(this._transitionChangedId);
            this._transitionChangedId = null;
        }

        this._extensionSettings = null;
        this._colorSettings = null;
    }

    _scheduleNext() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        const rawSchedule = this._extensionSettings
            .get_value("schedule")
            .deep_unpack();
        const schedule = rawSchedule.map(([hour, minute, temp]) => ({
            hour,
            minute,
            temp,
        }));

        if (schedule.length === 0) return;

        const fadeMinutes = this._extensionSettings.get_int("transition-time");
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = now.getSeconds();

        const targetTemp =
            getTempAtTime(
                schedule,
                currentMinutes,
                currentSeconds,
                fadeMinutes,
            );
        
        const secondsUntilNext =
            getNextWakeSeconds(
                schedule,
                currentMinutes,
                currentSeconds,
                fadeMinutes,
            );
        
        const currentTemp = this._colorSettings.get_uint("night-light-temperature");
        
        if (currentTemp !== targetTemp)
            this._colorSettings.set_uint("night-light-temperature",targetTemp);

        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            secondsUntilNext,
            () => {
                this._scheduleNext();
                return GLib.SOURCE_REMOVE;
            },
        );
    }
}
