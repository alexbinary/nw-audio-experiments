'use strict';

onload = function() {

  var gui = require('nw.gui');
  var win = gui.Window.get();

  var menubar = new gui.Menu({ type: 'menubar' });
  if (menubar.createMacBuiltin) menubar.createMacBuiltin('NW.js Audio experiments');
  win.menu = menubar;

  win.showDevTools();

  /*
   * Utilities
   */

  function currentTime() {
    return (new Date()).getTime();
  }

  /*
   * Canvas initialization
   */

  const canvasCtx = domCanvas.getContext('2d');
  const canvasWidth = canvasCtx.canvas.width;
  const canvasHeight = canvasCtx.canvas.height;

  console.log(`canvas width: ${canvasWidth} px`);
  console.log(`canvas height: ${canvasHeight} px`);

  /*
   * Input file
   */

  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/splice_1.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/splice_2.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/audio.ogg';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/video.avi';
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/video.mkv';
  var filepath = '/Users/alexandrebintz/Movies/jupiter_ascending_2015_1080p.mp4';
  var filepath = '/Users/alexandrebintz/Movies/my_neighbor_totoro_1988_1080p_jpn_eng.mp4';
  var t1 = 0 + 25 *1000 + 10 *60*1000;
  var t2 = 0 + 50 *1000 + 10 *60*1000;
  var scale = 5;
  var filepath = '/Users/alexandrebintz/Documents/dev/_nwjs/nw-audio-experiments/video2.mkv';
  var t1 = 0 + 27 *1000 + 21 *60*1000;
  var t2 = 0 + 50 *1000 + 21 *60*1000;
  var scale = 30;

  console.log(`working on file ${filepath}`);

  // const t1 = 0 + 25 *1000 + 10 *60*1000;
  // const t2 = 0 + 50 *1000 + 10 *60*1000;
  const span = t2 - t1;

  console.log(`working between t1: ${t1} ms and t2: ${t2} ms (span: ${span} ms)`);

  /*
   * Inspect input file for its characteristics
   */

  require('node-ffprobe')(filepath, function(err, probeData) {

    let inputInfo = {
      duration : probeData.format.duration * 1000,
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

    console.log(`duration: ${inputInfo.duration} ms`);
    console.log(`tracks: ${inputInfo.tracks.length}`);
    for (let i=0, l=inputInfo.tracks.length; i<l; i++) {
      console.log(`track ${i}:`);
      console.log(`channels: ${inputInfo.tracks[i].channels}`);
      console.log(`sample rate: ${inputInfo.tracks[i].sampleRate}`);
    }

    onInputInfoLoaded(inputInfo);
  });

  function onInputInfoLoaded(inputInfo) {

    const trackIndex = 0;

    console.log(`working on track ${trackIndex}`);

    const trackInfo = inputInfo.tracks[trackIndex];
    const sampleRate = trackInfo.sampleRate;
    const totalSamples = Math.floor((t2-t1)/1000 * sampleRate);

    console.log(`total samples in period: ${totalSamples}`);

    /*
     * Extract volume data
     *
     * Results are good enough with :
     * > Low-pass filter @1Hz
     * > subSampling @20Hz
     */

    const fc = 1;  // Hz
    const a = 2*Math.PI*(1/sampleRate)*fc / (2*Math.PI*(1/sampleRate)*fc + 1);

    console.log(`low-pass frequency: ${fc} Hz (a = ${a})`);

    const overSamplingFactor = 20;
    const subSampling = Math.floor(sampleRate/fc/overSamplingFactor);

    console.log(`over sampling factor: ${overSamplingFactor}`);
    console.log(`subsampling: ${subSampling}`);

    const filteredSampleRate = sampleRate / subSampling;

    console.log(`filtered sample rate: ${filteredSampleRate}`);

    let samples = [];
    let c = 0;

    let totalSamplesRead = 0;
    let t0 = currentTime();

    console.log(`extracting all samples from file downmixed to 1 channel...`);

    require('pcm-extract').getStream({
      filepath: filepath,
      start: t1,
      end: t2,
      channels: 1,
      init: function() {
        this.count = 0;
      },
      processSample : function(sample) {
        sample = Math.abs(sample);
        if (this.out === undefined) {
          this.out = sample;
        } else {
          sample = this.out += a * (sample - this.out);
        }
        if ((++this.count % subSampling) === 0) {
          this.push(sample);
        }
      },
    }).on('readable', function() {
      const sample = this.read();
      if (sample !== null) {
        samples[c++] = sample;
        totalSamplesRead += 1;
      } else {
        console.log(`extraction complete in ${currentTime()-t0} ms`);
        console.log(`read ${totalSamplesRead} samples`);
        onSamplesRead(samples, filteredSampleRate);
      }
    });
  }

  function onSamplesRead(samples, filteredSampleRate) {

    /*
     * Extract local minima using a sliding window
     *
     * > time window of 300 ms gives good results...
     */

    console.log('computing minimum volume points...');

    const windowTimeSpan = 100;  // ms

    console.log(`using window time span: ${windowTimeSpan} ms`);

    const windowSampleSpan = Math.max(3, windowTimeSpan/1000 * filteredSampleRate);

    console.log(`sample span: ${windowSampleSpan}`);

    let minimaIndexes = [];

    for (let i=windowSampleSpan-1, l=samples.length; i<l; i++) {
      const headIndex = i;
      const tailIndex = i - (windowSampleSpan - 1);

      let min = undefined;
      let minIndex = undefined;
      for (let j=tailIndex, l=headIndex; j<=l; j++) {
        if (min === undefined || samples[j] < min) {
          min = samples[j];
          minIndex = j;
        }
      }
      if (minIndex !== tailIndex && minIndex !== headIndex) {
        if (minimaIndexes.indexOf(minIndex) === -1) {
          minimaIndexes.push(minIndex);
        }
      }
    }

    let minimaTime = minimaIndexes.map(function(index) {
      return t1 + index / filteredSampleRate * 1000;
    });

    console.log(`found ${minimaTime.length} points :`);
    console.log(minimaTime);

    /*
     * Prepare plotting
     */

    const pixelTimeStep = canvasWidth / (samples.length-1);

    /*
     * Play file between specified time range
     */

    const speed = 0.7;

    console.log(`playing file around cut points at speed ${speed}...`);

    var vlc = require('wcjs-renderer').init(domCanvasVideo, null, null, require('wcjs-prebuilt'));
    vlc.play(`file://${filepath}`);

    vlc.events.once('Playing', function() {
      console.log(`player ready, jumping and applying speed`);

      vlc.time = t1;
      vlc.input.rate = speed;

      let timeout;
      vlc.events.on('Buffering', function() {
        clearTimeout(timeout);
        timeout = setTimeout(onPlaying, 200);
      });
    });

    function onPlaying() {

      console.log(`playing`);

      const cutPauseDuration = 1000;  // ms

      let nextMinima = 0;
      let worldTimeLastStart = undefined;
      let mediaTimeLastStop = t1;

      function onCutPointReached() {
        vlc.pause();
        mediaTimeLastStop += (currentTime() - worldTimeLastStart)*speed;
        console.log(`pausing at cut point: ${minimaTime[nextMinima]} ms`);
        nextMinima++;
        if (nextMinima === minimaTime.length) {
          console.log(`reached last cut point, stopping`);
        } else {
          setTimeout(function() {
            onCutEnd();
          }, cutPauseDuration);
        }
      }

      function onCutEnd() {
        vlc.play();
        worldTimeLastStart = currentTime();
        console.log(`resuming until cut point: ${minimaTime[nextMinima]} ms`);
        setTimeout(function() {
          onCutPointReached();
        }, (minimaTime[nextMinima]-(minimaTime[nextMinima-1] || t1))/speed);
      }

      onCutEnd();

      function update() {
        requestAnimationFrame(update);

        const offset = 0;
        const t = (vlc.playing
          ? (currentTime() - worldTimeLastStart) * speed + mediaTimeLastStop
          : mediaTimeLastStop)
           - offset;

        const markers = [
          t,
        ].concat(minimaTime);

        /*
         * Plot all samples on available space
         */

        canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        canvasCtx.beginPath();
        canvasCtx.strokeStyle = 'blue';

        for (let i=0,l=samples.length; i<l; i++) {
          const x = i * pixelTimeStep;
          const y = samples[i] * canvasHeight * scale;

          canvasCtx.lineTo(x, canvasHeight - y);
        }
        canvasCtx.stroke();

        for (let i=0, l=markers.length; i<l; i++) {
          const x = canvasWidth * (markers[i]-t1)/(t2-t1);
          canvasCtx.lineWidth = i===0 ? 2 : 1;
          canvasCtx.strokeStyle = i===0 ? 'red' : 'grey';
          canvasCtx.beginPath();
          canvasCtx.moveTo(x, 0);
          canvasCtx.lineTo(x, canvasHeight);
          canvasCtx.stroke();
        }
      }
      update();
    }

  }

};
