/**
 * Used to sort based on number of plays in reverse order.
 */
function comparePlaysReverse(a,b) {
  if (a.numberOfPlays < b.numberOfPlays)
    return 1;
  if (a.numberOfPlays > b.numberOfPlays)
    return -1;
  return 0;
}

/**
 * Keep annotations to a minimum to avoid business on the screen.
 * This will return a smaller set of annotations that should be displayed.
 */
function pruneAnnotations(annotations) {
  let values = []
  annotations.forEach((group) => {
    if (group.length == 0) return;
    group.sort(comparePlaysReverse);
    const mostPlayed = group[0];
    if (mostPlayed.numberOfPlays == 0) return;
    values.push(mostPlayed);
    if (group.length <= 1) return;
    for (let i = 1; i < 3 && i < group.length; i++) {
      if (group[i].numberOfPlays == 0) return;
      if (i < 2)
        values.push(group[i]);
      else if (mostPlayed.numberOfPlays - group[i].numberOfPlays < 10)
        values.push(group[i]);
    }
  });
  return values;
}

/**
 * Pick the font size for the annotations based on number of plays
 */
function pickFontSize(numberOfPlays) {
  if (numberOfPlays > 12) return 12;
  if (numberOfPlays < 8) return 8;
  return numberOfPlays;
}

/**
 * Render data based on plotly. Period is passed in order to label
 * the plot.
 */
function render(data, period) {
  const plotDiv = document.getElementById('plot');
  let traces = [];
  let annotations = [];
  let sums = {}
  data.forEach((point) => {
    let xs = [];
    let ys = [];
    for (let i in point.events) {
      xs.push(i);
      ys.push(point.events[i]);
      sums[i] = (sums[i] || 0) + point.events[i];
      annotations[i] = annotations[i] || [];
      annotations[i].push(
        {
          x: i,
          // Y value is offset because it looks better
          // TODO: figure out how to position the annotations so that they
          // don't overlap
          y: sums[i] - 5,
          // Custom value for us to keep track of the plays
          numberOfPlays: point.events[i],
          text: point.primary_artist + ' (' + point.events[i] + ' plays)',
          ax: 0,
          ay: 0,
          font: {size: pickFontSize(point.events[i])},
        }
      );
    }
    let trace = {
      x: xs,
      y: ys,
      mode: 'markers',
      name: point.primary_artist,
      showlegend: false,
      stackgroup: 'everything',
      hoverinfo: 'text'
    };
    // The hover text for each point
    const texts = ys.map((y) => {
      if (y == 0) return '';
      return point.primary_artist + ' (' + y + ' plays)';
    });
    trace['text'] = texts;
    traces.push(trace);
  });
  const pruned = pruneAnnotations(annotations);
  // Capitalise period to make it look good
  const capitalised = period.charAt(0).toUpperCase() + period.slice(1);
  const layout = {
    title: `Artist Plays Per ${capitalised}`,
    annotations: pruned
  };
  Plotly.newPlot(plotDiv, traces, layout);
}

/**
 * Query database with period as 'week', 'month' or 'day'
 */
function query(period, start, end) {
  // Reset page back to loading screen
  document.getElementById("query-form").style.display = "none";
  document.getElementById("plot").style.display = "none";
  document.getElementById("loading").style.display = "block";
  // Create the query
  const query = `?user=${user}&start=${start}&end=${end}&group_by=${period}`;
  const url = `${apiGatewayEndpoint}/playsPerArtist${query}`;
  // Make HTTP request to get data
  fetch(url)
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      // Hide loading spinner
      document.getElementById("loading").style.display = "none";
      // Display plot
      document.getElementById("plot").style.display = "block";
      document.getElementById("query-form").style.display = "block";
      // Render to a graph
      render(json, period);
    })
    .catch((error) => {
      // Hide loading spinner
      document.getElementById("loading").style.display = "none";
      // Display error
      document.getElementById("error").style.display = "block";
      console.error('Error:', error)
    });
}

// Parameters that will be changed via UI
let start = moment().subtract(3, 'month').unix();
let end = moment().unix();
let groupby = "week";

/**
 * Setup dropdown listeners
 */
function setupViews() {
  // Group by form
  $('#groupby')
  .dropdown({
    action: 'activate',
    onChange: (text, value) => {
      groupby = text;
      // Query data with new interval
      query(groupby, start, end);
    }
  });

  // Custom range dropdown
  $('#range')
  .dropdown({
    action: 'activate',
    onChange: (text, value) => {
      console.log("CHANGING", text, value);
      document.getElementById("start-form").style.display = "none";
      document.getElementById("end-form").style.display = "none";

      switch(text) {
        case 'custom':
          // For custom we just display the date picker
          // We need to use flex here so that all the form elements stay on the
          // same line
          document.getElementById("start-form").style.display = "flex";
          document.getElementById("end-form").style.display = "flex";
          // Don't re-do a query
          return;
        case 'two-weeks':
          start = moment().subtract(2, 'week').unix();
          end = moment().unix();
          break;
        case 'three-months':
          start = moment().subtract(3, 'month').unix();
          end = moment().unix();
          break;
        case 'year':
          start = moment().subtract(1, 'year').unix();
          end = moment().unix();
          break;
      }
      // Query data with new interval
      query(groupby, start, end);
    }
  });

  // The date pickers
  $('#range-start').calendar({
    type: 'date',
    endCalendar: $('#range-end'),
    onChange: (date, text, mode) => {
      // Don't query but set the start timestamp
      start = date.getTime() / 1000;
    }
  });
  $('#range-end').calendar({
    type: 'date',
    startCalendar: $('#range-start'),
    onChange: (date, text, mode) => {
      // Query now that we've set the end timestamp
      end = date.getTime() / 1000;
      query(groupby, start, end);
    }
  });
}
