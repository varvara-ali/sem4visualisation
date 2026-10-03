const { createApp } = Vue;

const COLORS = {
  men: '#65a9ed',
  women: '#ed8295',
  elite: '#367de0',
  amateur: '#ee93a2'
};

function parseRunner(runner) {
  const match = String(runner.country_and_age || '').match(/,\s*([MF])\s*(\d+)$/i);
  const gender = match ? match[1].toUpperCase() : null;
  const age = match ? Number(match[2]) : null;
  const timeMatch = String(runner.finish_time || '').match(/^(\d+):(\d{2}):(\d{2})$/);
  const finishSeconds = timeMatch
    ? Number(timeMatch[1]) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3])
    : null;
  return { ...runner, gender, age, finishSeconds };
}

function showTooltip(event, html) {
  const tooltip = d3.select('body').selectAll('.tooltip').data([null]).join('div').attr('class', 'tooltip');
  tooltip.html(html).style('left', `${event.clientX + 14}px`).style('top', `${event.clientY + 14}px`).style('display', 'block');
}

function hideTooltip() {
  d3.selectAll('.tooltip').style('display', 'none');
}

function chartSize(selector, fallbackHeight) {
  const node = document.querySelector(selector);
  return { width: Math.max(260, node?.clientWidth || 400), height: fallbackHeight };
}

function renderAgeChart(runners) {
  const root = d3.select('#age-chart');
  root.selectAll('*').remove();
  const { width, height } = chartSize('#age-chart', 285);
  const margin = { top: 8, right: 36, bottom: 26, left: 36 };
  const plotWidth = (width - margin.left - margin.right) / 2;
  const ageRunners = runners.filter((d) => d.age !== null && d.gender);
  const ages = d3.range(18, 81);
  const groups = ages.map((start) => ({
    start,
    label: String(start),
    men: ageRunners.filter((d) => d.gender === 'M' && d.age === start).length,
    women: ageRunners.filter((d) => d.gender === 'F' && d.age === start).length
  }));
  const max = d3.max(groups, (d) => Math.max(d.men, d.women)) || 1;
  const y = d3.scaleBand().domain(groups.map((d) => d.label)).range([margin.top, height - margin.bottom]).padding(.34);
  const x = d3.scaleLinear().domain([max, 0]).range([0, plotWidth]);
  const svg = root.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const center = margin.left + plotWidth;
  svg.append('line').attr('x1', center).attr('x2', center).attr('y1', margin.top).attr('y2', height - margin.bottom).attr('stroke', '#cfd4da');
  svg.append('g').selectAll('rect').data(groups).join('rect').attr('x', center - plotWidth).attr('y', (d) => y(d.label) + y.bandwidth() * .18).attr('width', plotWidth * 2).attr('height', Math.max(2, y.bandwidth() * .64)).attr('fill', '#eef0f2');
  svg.append('g').selectAll('line').data(groups).join('line').attr('class', 'grid-line')
    .attr('x1', center - plotWidth).attr('x2', center + plotWidth).attr('y1', (d) => y(d.label) + y.bandwidth() / 2).attr('y2', (d) => y(d.label) + y.bandwidth() / 2);
  const barHeight = Math.max(1.5, y.bandwidth() * .34);
  const drawBars = (key, sign, color) => svg.append('g').selectAll('rect').data(groups).join('rect')
    .attr('x', (d) => sign < 0 ? center - x(d[key]) : center)
    .attr('y', (d) => y(d.label) + (key === 'men' ? 0 : y.bandwidth() - barHeight))
    .attr('width', (d) => x(d[key])).attr('height', barHeight).attr('fill', color)
    .on('mousemove', (event, d) => showTooltip(event, `<strong>${d.label} лет</strong>${key === 'men' ? 'Мужчины' : 'Женщины'}: ${d[key]} человек`))
    .on('mouseleave', hideTooltip);
  drawBars('men', -1, COLORS.men);
  drawBars('women', 1, COLORS.women);
  svg.append('g').selectAll('text').data(groups.filter((d) => d.start % 2 === 0)).join('text').attr('class', 'age-label').attr('x', center + 8).attr('y', (d) => y(d.label) + y.bandwidth() / 2 + 4).text((d) => d.label);
  svg.append('text').attr('class', 'chart-note').attr('x', margin.left).attr('y', height - 5).text('мужчины');
  svg.append('text').attr('class', 'chart-note').attr('x', width - margin.right - 45).attr('y', height - 5).text('женщины');
}

function renderParticipantsSummary(runners) {
  const root = d3.select('#participants-summary');
  root.selectAll('*').remove();
  const men = runners.filter((d) => d.gender === 'M').length;
  const women = runners.filter((d) => d.gender === 'F').length;
  const total = men + women;
  const pct = (value) => total ? Math.round(value / total * 100) : 0;
  root.append('div').attr('class', 'participant-total').html(`${runners.length.toLocaleString('ru-RU')}<span>участников</span>`);
  [['men', 'мужчины', men], ['women', 'женщины', women]].forEach(([key, label, count]) => {
    const row = root.append('div').attr('class', 'participant-gender');
    row.append('div').attr('class', 'participant-gender-row').html(`<span class="participant-gender-label"><i class="participant-swatch participant-swatch--${key}"></i>${label}</span><strong class="participant-gender-count">${count.toLocaleString('ru-RU')} · ${pct(count)}%</strong>`);
    row.append('div').attr('class', `participant-bar participant-bar--${key}`).append('span').style('width', `${pct(count)}%`);
  });
}

function renderCountriesChart(runners) {
  const root = d3.select('#countries-chart');
  root.selectAll('*').remove();
  const { width, height } = chartSize('#countries-chart', 285);
  const margin = { top: 5, right: 52, bottom: 5, left: 0 };
  const counts = d3.rollup(runners, (v) => v.length, (d) => String(d.country_and_age || '').replace(/,\s*[MF]\s*\d+$/, '').trim() || 'Неизвестно');
  const data = [...counts].sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
  const total = runners.length;
  const y = d3.scaleBand().domain(data.map((d) => d[0])).range([margin.top, height - margin.bottom]).padding(.35);
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d[1]) || 1]).range([0, width - margin.left - margin.right]);
  const svg = root.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  svg.append('g').selectAll('rect').data(data).join('rect').attr('class', 'country-bar').attr('x', margin.left).attr('y', (d) => y(d[0])).attr('width', (d) => x(d[1])).attr('height', y.bandwidth())
    .on('mousemove', (event, d) => showTooltip(event, `<strong>${d[0]}</strong>${d[1].toLocaleString('ru-RU')} участника`)).on('mouseleave', hideTooltip);
  svg.append('g').selectAll('text').data(data).join('text').attr('class', 'country-name').attr('x', margin.left + 8).attr('y', (d) => y(d[0]) + y.bandwidth() / 2 + 4).text((d) => d[0]);
  svg.append('g').selectAll('text').data(data).join('text').attr('class', 'country-count').attr('text-anchor', 'end').attr('x', width).attr('y', (d) => y(d[0]) + y.bandwidth() / 2 + 4).text((d) => `${d[1].toLocaleString('ru-RU')} · ${Math.round(d[1] / total * 100)}%`);
  const others = runners.length - d3.sum(data, (d) => d[1]);
  root.append('div').attr('class', 'chart-note').style('margin-top', '10px').text(`Остальные страны — ${others.toLocaleString('ru-RU')} участников, каждая менее 1%`);
}

function formatTime(seconds) {
  if (seconds === null) return '—';
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
}

function renderAthletesChart(runners) {
  const root = d3.select('#athletes-chart');
  root.selectAll('*').remove();
  const { width, height } = chartSize('#athletes-chart', 285);
  const data = ['M', 'F'].flatMap((gender) => runners.filter((d) => d.gender === gender && d.finishSeconds !== null).slice(0, 3));
  const y = d3.scaleBand().domain(data.map((d) => d.name)).range([8, height - 8]).padding(.38);
  const svg = root.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  svg.append('g').selectAll('circle').data(data).join('circle').attr('class', (d) => `athlete-dot--${d.gender === 'M' ? 'men' : 'women'}`).attr('cx', 7).attr('cy', (d) => y(d.name) + y.bandwidth() / 2).attr('r', 5);
  svg.append('g').selectAll('text').data(data).join('text').attr('class', (d) => `athlete-name athlete-name--${d.gender === 'M' ? 'men' : 'women'}`).attr('x', 20).attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4).text((d) => d.name.length > 24 ? `${d.name.slice(0, 23)}…` : d.name);
  svg.append('g').selectAll('text').data(data).join('text').attr('class', 'athlete-time').attr('text-anchor', 'end').attr('x', width).attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4).text((d) => formatTime(d.finishSeconds));
}

function renderFinishChart(runners) {
  const root = d3.select('#finish-chart');
  root.selectAll('*').remove();
  const { width, height } = chartSize('#finish-chart', 390);
  const margin = { top: 12, right: 16, bottom: 35, left: 16 };
  const data = runners.filter((d) => d.finishSeconds !== null && d.gender).sort((a, b) => d3.ascending(Math.floor(a.finishSeconds / 60), Math.floor(b.finishSeconds / 60)) || d3.ascending(a.gender, b.gender) || d3.ascending(a.age, b.age));
  const min = d3.min(data, (d) => d.finishSeconds); const max = d3.max(data, (d) => d.finishSeconds);
  const x = d3.scaleLinear().domain([min, max]).range([margin.left, width - margin.right]);
  const minuteTicks = d3.range(Math.ceil(min / 600) * 600, max, 600);
  const svg = root.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  svg.append('g').selectAll('line').data(minuteTicks).join('line').attr('class', 'finish-grid').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', margin.top).attr('y2', height - margin.bottom);
  const rowHeight = Math.max(2, Math.min(8, (height - margin.top - margin.bottom) / data.length * 2.2));
  const lines = svg.append('g').selectAll('line').data(data).join('line').attr('class', (d) => `finish-line finish-line--${d.gender === 'M' ? 'men' : 'women'}`).attr('x1', (d) => x(d.finishSeconds)).attr('x2', (d) => x(d.finishSeconds)).attr('y1', (d, i) => height - margin.bottom - i * ((height - margin.top - margin.bottom) / data.length)).attr('y2', (d, i) => height - margin.bottom - i * ((height - margin.top - margin.bottom) / data.length) - rowHeight)
    .on('mousemove', (event, d) => showTooltip(event, `<strong>${d.name}</strong>${d.gender === 'M' ? 'Мужчина' : 'Женщина'} · ${d.age} лет<br>Финиш: ${formatTime(d.finishSeconds)}<br>Биб: ${d.bib_number}`)).on('mouseleave', hideTooltip);
  const axis = d3.axisBottom(x).ticks(Math.min(9, Math.floor(width / 100))).tickFormat((d) => formatTime(d));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`).call(axis);
  const legend = svg.append('g').attr('class', 'finish-legend').attr('transform', `translate(${margin.left},${height - 8})`);
  legend.append('line').attr('class', 'finish-line finish-line--men').attr('x1', 0).attr('x2', 15).attr('y1', 0).attr('y2', 0);
  legend.append('text').attr('x', 21).attr('y', 4).text('мужчины');
  legend.append('line').attr('class', 'finish-line finish-line--women').attr('x1', 88).attr('x2', 103).attr('y1', 0).attr('y2', 0);
  legend.append('text').attr('x', 109).attr('y', 4).text('женщины');
}

function renderDashboard(rawRunners) {
  const runners = rawRunners.map(parseRunner);
  renderAgeChart(runners);
  renderParticipantsSummary(runners);
  renderCountriesChart(runners);
  renderAthletesChart(runners);
  renderFinishChart(runners);
}

createApp({
  data() {
    return { runners: [], pageSize: 100, loading: true, error: '' };
  },
  computed: {
    visibleRunners() { return this.runners.slice(0, this.pageSize); },
    totalRunners() { return this.runners.length; },
    categoryCount() { return new Set(this.runners.map((runner) => runner.class)).size; }
  },
  methods: {
    formatNumber(value) { return d3.format(',')(value).replaceAll(',', ' '); }
  },
  async mounted() {
    try {
      const response = await fetch('runners.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.runners = await response.json();
      this.$nextTick(() => renderDashboard(this.runners));
    } catch (error) {
      this.error = `Не удалось загрузить runners.json: ${error.message}`;
    } finally {
      this.loading = false;
    }
  }
}).mount('#app');
