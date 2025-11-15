// ObservAI Dashboard - Main Application
class ObservAIDashboard {
    constructor() {
        this.socket = null;
        this.charts = {};
        this.trafficData = {
            timestamps: [],
            entries: [],
            exits: [],
            current: []
        };
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.initCharts();
        this.setupEventListeners();
    }

    setupWebSocket() {
        const WS_URL = 'http://localhost:5001';

        this.socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10
        });

        this.socket.on('connect', () => {
            console.log('Connected to ObservAI');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from ObservAI');
            this.updateConnectionStatus(false);
        });

        this.socket.on('metrics_update', (data) => {
            this.handleMetricsUpdate(data);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateConnectionStatus(false);
        });
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');

        if (connected) {
            dot.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            dot.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    handleMetricsUpdate(data) {
        console.log('Metrics update:', data);

        // Update KPIs
        this.updateKPIs(data);

        // Update charts
        this.updateCharts(data);

        // Update tracks
        this.updateTracks(data.tracks || []);

        // Update FPS
        if (data.fps) {
            document.getElementById('fpsCounter').textContent = `FPS: ${data.fps.toFixed(1)}`;
        }
    }

    updateKPIs(data) {
        document.getElementById('entriesValue').textContent = data.entry_count || 0;
        document.getElementById('exitsValue').textContent = data.exit_count || 0;
        document.getElementById('currentValue').textContent = data.current || 0;
        document.getElementById('queueValue').textContent = data.queue_count || 0;
    }

    initCharts() {
        // Gender Chart
        const genderEl = document.getElementById('genderChart');
        this.charts.gender = echarts.init(genderEl);
        this.charts.gender.setOption(this.getGenderChartOption());

        // Age Chart
        const ageEl = document.getElementById('ageChart');
        this.charts.age = echarts.init(ageEl);
        this.charts.age.setOption(this.getAgeChartOption());

        // Traffic Chart
        const trafficEl = document.getElementById('trafficChart');
        this.charts.traffic = echarts.init(trafficEl);
        this.charts.traffic.setOption(this.getTrafficChartOption());

        // Heatmap Chart
        const heatmapEl = document.getElementById('heatmapChart');
        this.charts.heatmap = echarts.init(heatmapEl);
        this.charts.heatmap.setOption(this.getHeatmapChartOption());

        // Resize handler
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => chart.resize());
        });
    }

    getGenderChartOption() {
        return {
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(20, 20, 28, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#fff' }
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                textStyle: { color: '#fff' }
            },
            series: [{
                name: 'Gender',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#0b0b10',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#fff'
                    }
                },
                labelLine: {
                    show: false
                },
                data: [
                    { value: 0, name: 'Male', itemStyle: { color: '#4FC3F7' } },
                    { value: 0, name: 'Female', itemStyle: { color: '#FF5252' } }
                ]
            }]
        };
    }

    getAgeChartOption() {
        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(20, 20, 28, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#fff' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: ['Child', 'Teen', 'Adult', 'Senior'],
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                axisLabel: { color: '#fff' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
                axisLabel: { color: '#fff' }
            },
            series: [{
                data: [0, 0, 0, 0],
                type: 'bar',
                barWidth: '60%',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#7C4DFF' },
                        { offset: 1, color: '#4FC3F7' }
                    ]),
                    borderRadius: [8, 8, 0, 0]
                }
            }]
        };
    }

    getTrafficChartOption() {
        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(20, 20, 28, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#fff' }
            },
            legend: {
                data: ['Entries', 'Exits', 'Current'],
                textStyle: { color: '#fff' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: [],
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                axisLabel: { color: '#fff' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
                axisLabel: { color: '#fff' }
            },
            series: [
                {
                    name: 'Entries',
                    type: 'line',
                    smooth: true,
                    data: [],
                    lineStyle: { color: '#4FC3F7', width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(76, 195, 247, 0.3)' },
                            { offset: 1, color: 'rgba(76, 195, 247, 0)' }
                        ])
                    }
                },
                {
                    name: 'Exits',
                    type: 'line',
                    smooth: true,
                    data: [],
                    lineStyle: { color: '#FFB74D', width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(255, 183, 77, 0.3)' },
                            { offset: 1, color: 'rgba(255, 183, 77, 0)' }
                        ])
                    }
                },
                {
                    name: 'Current',
                    type: 'line',
                    smooth: true,
                    data: [],
                    lineStyle: { color: '#7C4DFF', width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(124, 77, 255, 0.3)' },
                            { offset: 1, color: 'rgba(124, 77, 255, 0)' }
                        ])
                    }
                }
            ]
        };
    }

    getHeatmapChartOption() {
        return {
            tooltip: {
                position: 'top',
                backgroundColor: 'rgba(20, 20, 28, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#fff' }
            },
            grid: {
                height: '80%',
                top: '10%'
            },
            xAxis: {
                type: 'category',
                data: Array.from({length: 50}, (_, i) => i),
                splitArea: { show: true },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { show: false }
            },
            yAxis: {
                type: 'category',
                data: Array.from({length: 50}, (_, i) => i),
                splitArea: { show: true },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { show: false }
            },
            visualMap: {
                min: 0,
                max: 10,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '0%',
                inRange: {
                    color: ['#0b0b10', '#7C4DFF', '#4FC3F7', '#D4FB54']
                },
                textStyle: { color: '#fff' }
            },
            series: [{
                name: 'Heatmap',
                type: 'heatmap',
                data: [],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };
    }

    updateCharts(data) {
        // Update Gender Chart
        if (data.demographics && data.demographics.gender) {
            const genderData = [
                { value: data.demographics.gender.male || 0, name: 'Male', itemStyle: { color: '#4FC3F7' } },
                { value: data.demographics.gender.female || 0, name: 'Female', itemStyle: { color: '#FF5252' } }
            ];
            this.charts.gender.setOption({
                series: [{ data: genderData }]
            });
        }

        // Update Age Chart
        if (data.demographics && data.demographics.age_groups) {
            const ageData = [
                data.demographics.age_groups.child || 0,
                data.demographics.age_groups.teen || 0,
                data.demographics.age_groups.adult || 0,
                data.demographics.age_groups.senior || 0
            ];
            this.charts.age.setOption({
                series: [{ data: ageData }]
            });
        }

        // Update Traffic Chart
        const now = new Date().toLocaleTimeString();
        this.trafficData.timestamps.push(now);
        this.trafficData.entries.push(data.entry_count || 0);
        this.trafficData.exits.push(data.exit_count || 0);
        this.trafficData.current.push(data.current || 0);

        // Keep only last 20 data points
        if (this.trafficData.timestamps.length > 20) {
            this.trafficData.timestamps.shift();
            this.trafficData.entries.shift();
            this.trafficData.exits.shift();
            this.trafficData.current.shift();
        }

        this.charts.traffic.setOption({
            xAxis: { data: this.trafficData.timestamps },
            series: [
                { data: this.trafficData.entries },
                { data: this.trafficData.exits },
                { data: this.trafficData.current }
            ]
        });

        // Update Heatmap
        if (data.heatmap && Array.isArray(data.heatmap)) {
            const heatmapData = [];
            data.heatmap.forEach((row, y) => {
                if (Array.isArray(row)) {
                    row.forEach((value, x) => {
                        heatmapData.push([x, y, value || 0]);
                    });
                }
            });
            this.charts.heatmap.setOption({
                series: [{ data: heatmapData }]
            });
        }
    }

    updateTracks(tracks) {
        const grid = document.getElementById('tracksGrid');
        grid.innerHTML = '';

        tracks.forEach(track => {
            const card = document.createElement('div');
            card.className = 'track-card';
            card.innerHTML = `
                <div class="track-header">
                    <div class="track-id">Track #${track.id}</div>
                    <div class="track-gender ${track.gender || 'unknown'}">${track.gender || 'Unknown'}</div>
                </div>
                <div class="track-info">
                    <div class="track-info-item">
                        <span class="track-info-label">Age:</span>
                        <span class="track-info-value">${track.age || 'N/A'}</span>
                    </div>
                    <div class="track-info-item">
                        <span class="track-info-label">Dwell Time:</span>
                        <span class="track-info-value">${track.dwell_time ? track.dwell_time.toFixed(1) + 's' : 'N/A'}</span>
                    </div>
                    ${track.zone ? `
                    <div class="track-info-item">
                        <span class="track-info-label">Zone:</span>
                        <span class="track-info-value">${track.zone}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    setupEventListeners() {
        // Add any additional event listeners here
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ObservAIDashboard();
});
