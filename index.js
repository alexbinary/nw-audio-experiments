'use strict';

onload = function() {

  var gui = require('nw.gui');
  var win = gui.Window.get();

  var menubar = new gui.Menu({ type: 'menubar' });
  if (menubar.createMacBuiltin) menubar.createMacBuiltin('NW.js Audio experiments');
  win.menu = menubar;

  win.showDevTools();

  /*
   * Initialization
   */

  const canvasCtx = domCanvas.getContext('2d');
  const canvasWidth = canvasCtx.canvas.width;
  const canvasHeight = canvasCtx.canvas.height;

  console.log(`canvas width: ${canvasWidth} px`);
  console.log(`canvas height: ${canvasHeight} px`);

  /*
   * Input file
   */

  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/video.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/splice_1.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/splice_2.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/audio.ogg';
  var filepath = '/Users/alexandrebintz/Movies/my_neighbor_totoro_1988_1080p_jpn_eng.mp4';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/video.mkv';

  /*
   * Inspect input file for its characteristics
   */

  require('node-ffprobe')(filepath, function(err, probeData) {

    let inputInfo = {
      duration : Math.floor(probeData.format.duration * 1000),
      tracks : [],
    };

    for (let i in probeData.streams) {
      if (probeData.streams[i].codec_type === 'audio') {

        inputInfo.tracks.push({
          sampleRate : probeData.streams[i].sample_rate,
          channels : probeData.streams[i].channels,
        });
      }
    }

    console.log('inputInfo:');
    console.log(inputInfo);

    onInputInfoLoaded(inputInfo);
  });

  /*
   * Audio graph
   */

  function onInputInfoLoaded(inputInfo) {

    const t1 = 0 + 0 *1000 + 1 *60*1000;
    // const span = inputInfo.duration;
    const span = 0 + 10 *1000 + 0 *60*1000;
    const t2 = t1 + span;

    console.log(`t1: ${t1} ms`);
    console.log(`t2: ${t2} ms`);
    console.log(`span: ${span} ms`);

    const sampleRate = inputInfo.tracks[0].sampleRate;
    const totalSamples = Math.floor((t2-t1)/1000 * sampleRate);

    console.log(`sample rate: ${sampleRate}`);
    console.log(`total samples: ${totalSamples}`);

    const fc = 10;  // cut signal under 20 Hz
    const subSampling = Math.floor(sampleRate/fc/2);  // Shannon
    const totalSamplesFc = Math.floor(totalSamples/subSampling);

    console.log(`fc: ${fc} Hz`);
    console.log(`subSampling: ${subSampling}`);
    console.log(`samples: ${totalSamplesFc}`);

    const a = 2*Math.PI*(1/sampleRate)*fc / (2*Math.PI*(1/sampleRate)*fc + 1);

    console.log(`a: ${a}`);

    let samples = new Array(totalSamples);
    let c = 0;

    const t0 = (new Date()).getTime();

    require('pcm-extract').getStream({
      filepath: filepath,
      start: t1,
      end: t2,
      channels: 1,
      processSample : function(sample) {
        sample = Math.abs(sample);
        if (this.out === undefined) {
          this.out = sample;
        } else {
          sample = this.out += a * (sample - this.out);
        }
        if ((this.count = (++this.count || 0) % subSampling) === 0) {
          this.push(sample);
        }
      },
    }).on('readable', function(){
      const sample = this.read();
      if (sample !== null) {
        samples[c++] = sample;
      } else {
        console.log('end');
        console.log((new Date()).getTime() - t0 + ' ms');
        // draw();
      }
    });

    const baseline = canvasHeight / 2;
    const baseScale = baseline * 0.9;

    const curve = {
      // points: samples,
      scale: 20,
      color: 'blue',
      timestep: 1/(sampleRate/subSampling)*1000,
    };

    // playFile({
    //   onAnimationFrame: function update(t) {
    //
    //     canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    //
    //     canvasCtx.beginPath();
    //     canvasCtx.strokeStyle = 'black';
    //     canvasCtx.moveTo(0, baseline);
    //     canvasCtx.lineTo(canvasWidth, baseline);
    //     canvasCtx.stroke();
    //
    //     const step = canvasWidth * curve.timestep / (t2-t1);
    //
    //     canvasCtx.beginPath();
    //     canvasCtx.strokeStyle = curve.color;
    //
    //     for (let j=0, l=samples.length; j<l; j++) {
    //
    //       canvasCtx.moveTo(j * step, baseline + samples[j] * baseScale * curve.scale);
    //       canvasCtx.lineTo(j * step, baseline - samples[j] * baseScale * curve.scale);
    //     }
    //     canvasCtx.stroke();
    //   }
    // });

    // draw();
    //
    // function draw() {
    //
    //   console.log('draw');
    //
    //   canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    //
    //   canvasCtx.beginPath();
    //   canvasCtx.strokeStyle = 'black';
    //   canvasCtx.moveTo(0, baseline);
    //   canvasCtx.lineTo(canvasWidth, baseline);
    //   canvasCtx.stroke();
    //
    //   const step = canvasWidth * curve.timestep / (t2-t1);
    //
    //   canvasCtx.beginPath();
    //   canvasCtx.strokeStyle = curve.color;
    //
    //   for (let j=0, l=samples.length; j<l; j++) {
    //
    //     canvasCtx.moveTo(j * step, baseline + samples[j] * baseScale * curve.scale);
    //     canvasCtx.lineTo(j * step, baseline - samples[j] * baseScale * curve.scale);
    //   }
    //   canvasCtx.stroke();
    //
    //   requestAnimationFrame(draw);
    // }
  }

  /**
   * API design
   */

  // I have :
  // - a video file
  // - a canvas of given width

  // I want :
  // - to draw the complete or partial audio waveform on the entire canvas
  // - change the subsection and redraw live
  // - have the waveform to always be dense in the allocated space
  // - get the time of minimum volume in a subsection

  // I do :
  // - request full waveform for file given my canvas width
  // - request partial waveform for file given my canvas width
  // - request whether a certain subsection of the waveform can be properly drawn within my canvas width
  // - draw complete waveform on my canvas so that it fills the available space
  // - draw partial waveform on my canvas so that it fills the available space

  // I get :
  // - a bundle containing the data points (loaded asynchronously) and helper methods


  // tb = tb({ file: myfile })
  //
  // requestAnimationFrame(function(){
  //  drawWaveform(wf.points, startIndex, endIndex);
  // })
  //
  // wf = tb.loadWaveform(canvasWidth);
  // startIndex = undef
  // endIndex = undef
  //
  // time span (zoom) or canvas width changes :
  //
  // if (wf.suitedForViewSettings(canvasWidth, tend - tstart))
  //    wf = loadWaveform(canvasWidth, tstart, tend)
  //    startIndex = undef
  //    endIndex = undef
  // else
  //    startIndex = wf.indexForTime(tstart)
  //    endIndex = wf.indexForTime(tend)
  //
  // t = wf.getMinVolTime(tstart, tend);
  // t = wf.snapToMinVol(tref);

  /**
   * Initialization
   */

  // const sampleRate = 44100;
  // const channels = 2;
  //
  // const canvasCtx = domCanvas.getContext('2d');
  // const canvasWidth = canvasCtx.canvas.width;
  // const canvasHeight = canvasCtx.canvas.height;
  //
  // const t1 = 0 * 1000;
  // const t2 = 10 * 1000;
  //
  // let tMinVol = undefined;
  //
  // var audiobox = require('./audiobox')({
  //   filepath   : `${filepath}${filename}`,
  //   channels   : channels ,
  //   sampleRate : sampleRate ,
  // });
  //
  // console.log(`setting canvas width: ${canvasWidth} px`);
  // audiobox.setCanvasWidth(canvasWidth);
  //
  // console.log('loading waveform data...');
  // const waveformStream = audiobox.loadWaveform(null, null, function() {
  //   console.log('waveform loaded');
  // });
  //
  // playFile({
  //   onAnimationFrame: function update(t) {
  //
  //     const samples = [{
  //       samples: audiobox.waveform,
  //       scale: 10,
  //     }];
  //
  //     const markers = [
  //       audiobox.getIndexForTime(t),
  //       audiobox.getIndexForTime(tMinVol),
  //     ];
  //
  //     const colors = ['blue', 'green'];
  //
  //     const baseline = canvasHeight/2;
  //     const sampleScale = baseline*0.9;
  //
  //     canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  //
  //     canvasCtx.beginPath();
  //     canvasCtx.strokeStyle = 'black';
  //     canvasCtx.moveTo(0, baseline);
  //     canvasCtx.lineTo(canvasWidth, baseline);
  //     canvasCtx.stroke();
  //
  //     const step = canvasWidth / (audiobox.getTotalSamples()-1);
  //
  //     for (let j=0, l=samples.length; j<l; j++) {
  //
  //       canvasCtx.beginPath();
  //       canvasCtx.strokeStyle = colors[j];
  //       for (let i=0; i<samples[j].samples.length; i++) {
  //         canvasCtx.moveTo(i*step, baseline - samples[j].samples[i]*sampleScale*samples[j].scale);
  //         canvasCtx.lineTo(i*step, baseline + samples[j].samples[i]*sampleScale*samples[j].scale);
  //       }
  //       canvasCtx.stroke();
  //     }
  //
  //     for (let i=0; i<markers.length; i++) {
  //       canvasCtx.beginPath();
  //       canvasCtx.strokeStyle = 'red';
  //       canvasCtx.moveTo(markers[i]*step, 0);
  //       canvasCtx.lineTo(markers[i]*step, canvasHeight);
  //       canvasCtx.stroke();
  //     }
  //   }
  // })

  /* */

  // /**
  //  * Plot samples with markers
  //  *
  //  * @param samples array<array<number>>
  //  *        samples to plot, multiple curves, length at will
  //  *
  //  * @param markers array<number>
  //  *        marker to show, values are time values
  //  *
  //  * @param sampleAmp number ammplification factor for the samples
  //  */
  // function plot(opts) {
  //   const samples = opts.samples;
  //   const markers = opts.markers;
  //   const sampleAmp = opts.sampleAmp;
  //
  //   const ctx = domCanvas.getContext('2d');
  //   const canvasWidth = ctx.canvas.width;
  //   const canvasHeight = ctx.canvas.height;
  //   const baseline = canvasHeight/2;
  //   const sampleScale = baseline*0.9*(sampleAmp || 1);
  //
  //   ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  //
  //   ctx.beginPath();
  //   ctx.strokeStyle = 'black';
  //   ctx.moveTo(0, baseline);
  //   ctx.lineTo(canvasWidth, baseline)
  //   ctx.stroke();
  //
  //   const step = canvasWidth / (samples[0].length-1);
  //   const colors = ['blue', 'green', 'pink', 'brown'];
  //
  //   for (let j=0, l=samples.length; j<l; j++) {
  //
  //     ctx.beginPath();
  //     ctx.strokeStyle = colors[j];
  //     for (let i=0; i<samples[j].length; i++) {
  //       ctx.lineTo(i*step, baseline - samples[j][i]*sampleScale);
  //     }
  //     ctx.stroke();
  //   }
  //
  //   for (let i=0; i<markers.length; i++) {
  //     ctx.beginPath();
  //     ctx.strokeStyle = 'red';
  //     ctx.moveTo(markers[i]*step, 0);
  //     ctx.lineTo(markers[i]*step, canvasHeight);
  //     ctx.stroke();
  //   }
  // }

  /**
   * Play file with VLC
   *
   * @param onTimeChange callback gets the time in ms
   *        (lower update frequency, higher time trust)
   * @param onAnimationFrame callback gets the time in ms
   *        (higher update frequency, lower time trust)
   */
  function playFile(opts) {
    const onTimeChange = opts.onTimeChange;
    const onAnimationFrame = opts.onAnimationFrame;

    console.log(`playing file ${filepath}...`);

    var vlc = require('wcjs-renderer').init(domCanvasVideo, null, null, require('wcjs-prebuilt'));
    vlc.play(`file://${filepath}`);

    if (onTimeChange) {
      vlc.events.on('TimeChanged', onTimeChange);
    }

    vlc.events.on('Playing', function() {
      console.log('playing');

      if (onAnimationFrame) {

        function currentTime() {
          return (new Date()).getTime();
        }

        const t0 = currentTime();

        function update() {

          const t = currentTime();
          const dt = t - t0;

          onAnimationFrame(dt);
          requestAnimationFrame(update);
        }
        update();
      }
    });

    return vlc;
  }

  // console.log(`reading samples from file ${filepath}...`);
  //
  // var audioFile = audio(`${filepath}${filename}`);
  // audioFile.readSamples(, function(stereoSamples) {
  //
  //   console.log(`read ${stereoSamples.L.length}(L) ${stereoSamples.R.length}(R) samples`);
  //
  //   const samples = stereoSamples.L;
  //
  //   // RMS
  //   const rmsWindowSize = sampleRate * 1; // 1 sec
  //   const rms = audioFile.rms(samples, rmsWindowSize);
  //
  //   // Local minima
  //   const minima = audio.getMinima(rms);
  //   const minimaIndexes = minima.map(function(minimum) {
  //     return minimum.index;
  //   });
  //
  //   // let nextPoint = 0;
  //   const vlc = playFile({
  //     onTimeChange: function(time) {
  //       // if (time > points[nextPoint]) {
  //       //   console.log(`>> reached point`);
  //       //   while(time > points[nextPoint]) nextPoint++;
  //       // } else {
  //       //   console.log(`next point in ${Math.floor((points[nextPoint]-time)/1000)}`);
  //       // }
  //     },
  //     onAnimationFrame: function(t) {
  //
  //       let samples = [];
  //       let markers = [];
  //
  //       // const start = Math.floor(44100*9.2);
  //       // const length = Math.floor(44100*0.6);
  //       // samples = rms.slice(start, start + length);
  //
  //       samples = samples.concat([rms]);
  //       // samples = samples.concat([rms_smooth]);
  //
  //       markers = markers.concat(sampleIndexForTime(t));
  //       // markers = markers.concat(minimum.index);
  //       markers = markers.concat(minimaIndexes);
  //
  //       plot({
  //         samples: samples,
  //         markers: markers,
  //         sampleAmp: 1000,
  //       });
  //
  //       // const dt = 10000;
  //       //
  //       // const headIndex = Math.floor(t / dt);
  //       // const headOffset = headIndex * dt;
  //       //
  //       // plotRMSFromTime(rmss, headOffset, dt, [t-headOffset].concat(points));
  //
  //       // plotRMSAtTime(t);
  //
  //       // const time = vlc.time;
  //       // var i = Math.floor(time/1000 * 44100);
  //       // // console.log(i);
  //       // var sum = sums[i];
  //       // console.log(sum);
  //       // plot([sum,sum]);  // trick to draw a line
  //     },
  //   });
  // });

  /* */
  /* WebAudio API
  /* (+) realtime processing & visualisation
  /* (-) limited file formats, audio only
  /* (-) no offline capability
  /* */

  // const audioCtx = new AudioContext();
  //
  // function loadAndDecode(callback) {
  //
  //   console.log(`loading '${filename}' using XHR...`);
  //
  //   var request = new XMLHttpRequest();
  //   request.open('GET', filename, true);
  //   request.responseType = 'arraybuffer';
  //   request.onload = function() {
  //
  //     console.log('loaded');
  //     console.log(`decoding using 'audioCtx.decodeAudioData'...`);
  //
  //     var audioData = request.response;
  //     audioCtx.decodeAudioData(audioData,
  //
  //       function(decodedData) {
  //         console.log('decoded');
  //         callback(decodedData);
  //       },
  //       function(err) {
  //         console.log('decoding ERROR', err);
  //       }
  //     );
  //   };
  //   request.send();
  // }
  //
  // loadAndDecode(function(decodedData) {
  //
  //   console.log('creating audio graph...');
  //
  //   var src = audioCtx.createBufferSource();
  //   src.buffer = decodedData;
  //
  //   var analyser = audioCtx.createAnalyser();
  //   // analyser.fftSize = 2048; // default value
  //
  //   src.connect(analyser);
  //   analyser.connect(audioCtx.destination);
  //
  //   console.log('audio graph created');
  //
  //   // console.log('starting...');
  //   //
  //   // function update() {
  //   //
  //   //   const timeDataArray = new Float32Array(analyser.fftSize);
  //   //   analyser.getFloatTimeDomainData(timeDataArray);
  //   //
  //   //   plot(timeDataArray);
  //   //
  //   //   console.log('updating');
  //   //
  //   //   requestAnimationFrame(update);
  //   // }
  //   //
  //   // src.start();
  //   //
  //   // console.log('started');
  //   //
  //   // update();
  //
  // });

};
