/* graph.js
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

import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Cairo from 'gi://cairo';
import PangoCairo from 'gi://PangoCairo';

const MIN_TEMP = 1600;
const MAX_TEMP = 6500;

export function createScheduleGraph(schedule, clockFormat) {

    const marginLeft = 12;
    const marginRight = 12;
    const marginBottom = 26;
    const marginTop = 12;

    function tempToY(temp, height) {
        const ratio = (temp - MIN_TEMP) / (MAX_TEMP - MIN_TEMP);
        return height - (ratio * height);
    }
    
    function getScheduleIndexAtTime(schedule, time) {
        for (let i = 0; i < schedule.length; i++) {
            const current = schedule[i];
            const currentTime = current.hour + current.minute / 60;
            const next = schedule[i + 1];
            if (!next) return i;
            const nextTime = next.hour + next.minute / 60;
            if (time >= currentTime && time < nextTime) return i;
        }
        return -1;
    }

    const drawingArea = new Gtk.DrawingArea({
        content_height: 220,
        hexpand: true,
    });

    
    let hoverCallback = null;
    let hoverTime = null;
    let hoverTemp = null;
    
    drawingArea.setHoverCallback = function(callback) {
        hoverCallback = callback;
    };
    
    drawingArea.set_draw_func((area, cr, width, height) => {
    
        const context = area.get_style_context();
        const color = context.get_color();
    
        const graphWidth = width - marginLeft - marginRight;
        const graphHeight = height - marginBottom - marginTop;
    
        function graphX(hour) {
            return marginLeft + (hour / 24) * graphWidth;
        }
    
        function graphY(temp) {
            return marginTop + tempToY(temp, graphHeight);
        }

        
        /* Grid lines */
        
        cr.setSourceRGBA(color.red, color.green, color.blue, 0.25);
        cr.setLineWidth(1);
    
        for (let h = 0; h <= 24; h += 6) {
            let x = Math.round(graphX(h)) + 0.5;
            cr.moveTo(x, marginTop);
            cr.lineTo(x, marginTop + graphHeight);
        }
    
        cr.stroke();
        
        /* Graph border */
        
        cr.setSourceRGBA(color.red, color.green, color.blue, 0.25);
        cr.setLineWidth(1);
        
        cr.rectangle(
            marginLeft,
            marginTop,
            graphWidth,
            graphHeight
        );
        cr.stroke();
        
        /* Build curve */
        
        cr.newPath();
        
        for (let i = 0; i < schedule.length; i++) {
            const current = schedule[i];
            const x = graphX(current.hour + current.minute / 60);
            const y = graphY(current.temp);
        
            if (i === 0) {
                cr.moveTo(x, y);
            } else {
                const prev = schedule[i - 1];
                const prevY = graphY(prev.temp);
                cr.lineTo(x, prevY);
                cr.lineTo(x, y);
            }
        }
        
        if (schedule.length > 0) { 
            const last = schedule[schedule.length - 1];
            const lastY = graphY(last.temp);
            const endX = graphX(24);
            cr.lineTo(endX, lastY); // extend last temperature to 24:00
        }
    
        /* Gradient fill */
        
        let gradient = new Cairo.LinearGradient(
            0,
            marginTop,
            0,
            marginTop + graphHeight
        );
    
        gradient.addColorStopRGBA(1, 1.0, 0.45, 0.1, 0.30);
        gradient.addColorStopRGBA(0.5, 1.0, 0.8, 0.4, 0.20);
        gradient.addColorStopRGBA(0, 1.0, 1.0, 1.0, 0.12);
    
        cr.lineTo(graphX(24), marginTop + graphHeight);
        cr.lineTo(graphX(0), marginTop + graphHeight);
        cr.closePath();
    
        cr.setSource(gradient);
        cr.fillPreserve();
    
        /* Stroke curve */
        
        cr.setSourceRGBA(1.0, 0.5, 0.1, 0.9);
        cr.setLineWidth(2);
        cr.stroke();
    
        /* Draw points */
        
        for (let entry of schedule) {
            const x = graphX(entry.hour + entry.minute / 60);
            const y = graphY(entry.temp);
            cr.arc(x, y, 3.5, 0, Math.PI * 2);
            cr.fill();
        }
        
        /* Draw text */

        function drawText(text, centerX, y) {
            const layout = area.create_pango_layout(text);
            const [w, h] = layout.get_pixel_size();        
            let x = centerX - w / 2;

            if (x < marginLeft) x = marginLeft;
            if (x + w > width - marginRight) x = width - marginRight - w;
        
            cr.moveTo(x, y);
            PangoCairo.show_layout(cr, layout);
        }
        
        /* Current time indicator vertical line */
        
        const now = GLib.DateTime.new_now_local();
        const hour = now.get_hour();
        const minute = now.get_minute();
        const currentTime = hour + minute / 60;
        const x = Math.round(graphX(currentTime)) + 0.5;
        const temp = getTempAtTime(schedule, currentTime);
        const dotY = graphY(temp);
        
        cr.setLineWidth(1.0);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.moveTo(x, marginTop + graphHeight);
        cr.lineTo(x, dotY);
        cr.setSourceRGBA(color.red, color.green, color.blue, 0.6);
        cr.stroke();
        
        /* Draw dot at current time */
        
        cr.setSourceRGBA(color.red, color.green, color.blue, 0.6);
        cr.arc(x, dotY, 3.5, 0, Math.PI * 2);
        cr.fill();
        
        /* x-axis labels */
        
        cr.setSourceRGBA(
            color.red,
            color.green,
            color.blue,
            1.0
        );

        for (let h = 0; h <= 24; h += 6) {

            let axisLabel;

            if (clockFormat === "24h") {
                 axisLabel = h.toString().padStart(2, '0');
            } else {
                const normalized = h % 24;
                const period = normalized >= 12 ? "PM" : "AM";
                const hour = normalized % 12 || 12;
                axisLabel = `${hour} ${period}`;
            }
            
            let x = graphX(h);

            drawText(
                axisLabel,
                x,
                marginTop + graphHeight + 4
            );
        }
        
        /* Hover label */
        
        if (hoverTime !== null) {
                
            let hour = Math.floor(hoverTime);
            let minute = Math.round((hoverTime - hour) * 60);
        
            minute = Math.round(minute / 5) * 5;
            if (minute === 60) {
                minute = 0;
                hour += 1;
                if (hour === 24) hour = 0;
            }
        
            const minuteStr = minute.toString().padStart(2, "0");
            let timeStr;
            
            if (clockFormat === "24h") {
                timeStr = `${hour.toString().padStart(2,"0")}:${minuteStr}`;
            } else {
                let displayHour = hour % 12;
                if (displayHour === 0) displayHour = 12;
                const ampm = hour < 12 ? "AM" : "PM";
                timeStr = `${displayHour}:${minuteStr} ${ampm}`;
            }
        
            const label = `${timeStr}\n${hoverTemp}K`;
            const layout = area.create_pango_layout(label);
            const [textWidth, textHeight] = layout.get_pixel_size();
            const labelX = marginLeft + 6;
            const labelY = marginTop + 4;
            
            /* Draw text background box */
            
            /*
            cr.setSourceRGBA(color.red, color.green, color.blue, 0.2);
            cr.rectangle(labelX - 6, labelY - 3, textWidth + 12, textHeight + 6);
            cr.fill();
            */
        
            /* Draw text */

            cr.setSourceRGBA( color.red, color.green, color.blue, 0.9);
            cr.moveTo(labelX, labelY);
            PangoCairo.show_layout(cr, layout);
        
            /* Draw dot on curve */
       
            const hx = marginLeft + (hoverTime / 24) * (width - marginLeft - 12);
            const hy = marginTop + tempToY(hoverTemp, graphHeight);
        
            cr.setSourceRGBA(color.red, color.green, color.blue, 0.9);
            cr.arc(hx, hy, 5, 0, Math.PI * 2);
            cr.fill();
        }
    }); // end drawingArea.set_draw_func
    
    
    /* Motion controller */
    
    const motion = new Gtk.EventControllerMotion();
    
    motion.connect("motion", (controller, x, y) => {
    
        const width = drawingArea.get_width();
        const graphWidth = width - marginLeft - marginRight;
        const height = drawingArea.get_height();
        const graphHeight = height - marginTop - marginBottom;
        const time = ((x - marginLeft) / graphWidth) * 24;
        const temp = getTempAtTime(schedule, time);
    
        if (time < 0 || time > 24) {
            hoverTime = null;
            if (hoverCallback) hoverCallback(-1);  // remove row highlight
            drawingArea.queue_draw();
            return;
        }
    
        const curveY = marginTop + tempToY(temp, graphHeight);
        if (Math.abs(y - curveY) < graphHeight) {
            hoverTime = time;
            hoverTemp = temp;
            const index = getScheduleIndexAtTime(schedule, time);    
            if (hoverCallback) hoverCallback(index);
        } else {
            hoverTime = null;
            if (hoverCallback) hoverCallback(-1);
        }
    
        drawingArea.queue_draw();
    });
    drawingArea.add_controller(motion);
    
    motion.connect("leave", () => {
        hoverTime = null;
        if (hoverCallback) hoverCallback(-1);
        drawingArea.queue_draw();
    });
    
    
    function getTempAtTime(schedule, time) {
        let lastTemp = schedule[0].temp;
        for (let entry of schedule) {
            const t = entry.hour + entry.minute / 60;
            if (t > time) break;
            lastTemp = entry.temp;
        }
        return lastTemp;
    }
    
    drawingArea.setClockFormat = function(newFormat) {
        clockFormat = newFormat;
        drawingArea.queue_draw();
    };
    
    drawingArea.setSchedule = function(newSchedule) {
        schedule = newSchedule;
        drawingArea.queue_draw();
    };
    
    return drawingArea;
}
