/* scheduleUtils.js
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

 function getScheduleInfo(
     schedule,
     currentMinutes,
     fadeMinutes,
 ) {
     let currentEntry = schedule[schedule.length - 1];
     let nextEntry = schedule[0];
 
     for (let entry of schedule) {
         const entryMinutes = entry.hour * 60 + entry.minute;
 
         if (entryMinutes <= currentMinutes)
             currentEntry = entry;
         else {
             nextEntry = entry;
             break;
         }
     }
 
     let nextMinutes = nextEntry.hour * 60 + nextEntry.minute;
 
     if (nextMinutes <= currentMinutes)
         nextMinutes += 1440;
 
     const currentEntryMinutes = currentEntry.hour * 60 + currentEntry.minute;
     let adjustedCurrentEntryMinutes = currentEntryMinutes;
 
     if (nextMinutes >= 1440 && adjustedCurrentEntryMinutes < currentMinutes)
         adjustedCurrentEntryMinutes += 1440;
 
     const intervalMinutes = nextMinutes - adjustedCurrentEntryMinutes;
 
     const actualFadeMinutes =
         Math.min(
             fadeMinutes,
             intervalMinutes,
         );
 
     const fadeStart = nextMinutes - actualFadeMinutes;
     let adjustedCurrentMinutes = currentMinutes;
 
     if (nextMinutes >= 1440 && adjustedCurrentMinutes < currentEntryMinutes)
         adjustedCurrentMinutes += 1440;
 
     return {
         currentEntry,
         nextEntry,
         nextMinutes,
         fadeStart,
         adjustedCurrentMinutes,
         actualFadeMinutes,
     };
 }

export function getTempAtTime(
    schedule,
    currentMinutes,
    currentSeconds = 0,
    fadeMinutes = 10,
) {
    if (schedule.length === 0)
        return null;

    const info = getScheduleInfo(
        schedule,
        currentMinutes,
        fadeMinutes,
    );

    if (info.adjustedCurrentMinutes >= info.fadeStart && info.adjustedCurrentMinutes < info.nextMinutes) {
        if (info.actualFadeMinutes <= 0)
            return info.currentEntry.temp;
        
        const elapsed = info.adjustedCurrentMinutes - info.fadeStart + currentSeconds / 60;

        const progress = Math.max(
            0,
            Math.min(
                1,
                elapsed / info.actualFadeMinutes,
            ),
        );

        return Math.round(
            info.currentEntry.temp + (info.nextEntry.temp - info.currentEntry.temp) * progress
        );
    }

    return info.currentEntry.temp;
}

export function getNextWakeSeconds(
    schedule,
    currentMinutes,
    currentSeconds = 0,
    fadeMinutes = 10,
) {
    if (schedule.length === 0)
        return 60;

    const info = getScheduleInfo(
        schedule,
        currentMinutes,
        fadeMinutes,
    );

    const inFade = info.adjustedCurrentMinutes >=info.fadeStart && info.adjustedCurrentMinutes < info.nextMinutes;

    if (inFade) {
        return Math.max(
            1,
            60 - currentSeconds,
        );
    }

    const wakeMinutes =
        info.adjustedCurrentMinutes <
            info.fadeStart
            ? info.fadeStart
            : info.nextMinutes;

    return Math.max(
        1,
        (wakeMinutes - info.adjustedCurrentMinutes) * 60 - currentSeconds);
}