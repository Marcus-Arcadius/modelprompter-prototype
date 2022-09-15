<template lang='pug'>
q-page
  .q-pa-md
    .q-gutter-y-md
      q-card
        q-card-section
          q-tabs(v-model='tab' dense='' align='left' narrow-indicator='')
            q-tab(name='Images' label='Quick Prompt')
          q-separator
          //- Images tab
          q-tab-panels(v-model='tab' animated='')
            q-tab-panel(name='Images')
              //- @todo Add random placeholders
              q-input(v-model='prompt' label='Prompt' placeholder='a dr seuss illustration of robots building a city' autogrow @change='autosave')
                template(v-slot:append='')
                  q-btn(color='primary' label='Dream' icon='bubble_chart' :disabled='isWakingUp' @click='queueDream')
                  q-btn(v-if='isDreaming || isWakingUp' :disabled='isWakingUp' :loading='isWakingUp' color='negative' label='Stop' icon='cancel' @click='stopDreaming')
              template(v-for='server in settings.servers')
                template(v-if='server.isChecking || server.isDreaming || server.isWakingUp')
                  .flex.q-mt-md
                    div
                      q-linear-progress(style='flex: 1' dense color='blue' size='20px' :value='+(server.dreamProgress)/100' stripe='')
                        span(style='position: absolute; width: 100%; text-align: center; color: #fff; display: block; font-size: .65em') {{server.base}}
                      q-linear-progress.q-mt-sm(color='negative' size='10px' :value='settings.servers.length/(1+queue.length)')
                        span(style='position: absolute; width: 100%; text-align: center; color: #fff; display: block; font-size: .8em')
                    div(style='flex: 0 0 120px')
                      q-btn.q-ml-md(style='height: 100%' color='negative' width='100px' icon='cancel' label='stop' @click='stopServer(server)')
  .q-pa-md
    .q-col-gutter-md.row.items-start
      //- Config
      .col-4
        q-card
          q-card-section
            //- Basics
            q-badge Steps: {{ steps }} 
            q-slider(v-model='steps' :min='1' :max='150' :step='1' @change='autosave')
            q-badge Width: {{ width }} 
            q-slider(v-model='width' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            q-badge Height: {{ height }} 
            q-slider(v-model='height' :min='64' :max='2048' :step='64' @change='autosave' snap='')
            //- Batches
            q-badge Batch Size: {{ batchSize }} 
            q-input(dense='' type='number' min='1' v-model.number='batchSize' @change='autosave')
      //- Gallery
      .col-8
        .q-col-gutter-md.row.items-start
          .col-4(v-for='(img, key) in imgs' :key='key')
            q-card.cursor-pointer(@click='expandImage(img)')
              q-card-section.q-pa-sm
                q-img(:src='img')
  //- Image Modal
  q-dialog(v-model='imageModal')
    q-card.my-card(style='min-width: 300px')
      q-img(:src='imageModalActiveImage' style='height: 300px')
      q-card-section
</template>



<script>
import axios from 'axios'
import {mapState} from 'vuex'
import store from 'store'

const autosaveFields = ['queue', 'tab', 'prompt', 'sessionHash', 'lastImg', 'width', 'height', 'steps', 'batchSize']

/**
 * Converts data into a format for specific Stable Diffusion apis
 */
const sdDataScribe = function (context) {
  let data, promptDictionary, defaults

  // Select statement based on data api
  if (true) {
    data = []
    promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', '', '', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
    // promptDictionary = ['prompt', 'negative', '', 'steps', '', '', '', 'numBatches', 'batchSize', '', '', '', '', '', '', 'height', 'width', '', '', '', '', '', '', '', '']
    defaults = [context.defaultPrompt, '', 'None', 40, 'Euler a', false, false, 1, 1, 7, -1, -1, 0, 0, 0, context.height, context.width, 'None', null, 'Seed', '', 'Steps', '', false, []]
  
    // Build the data fro the given dictionary and defaults
    promptDictionary.forEach((key, n) => {
      if (key) {
        data.push(context[key] || defaults[n])
      } else {
        data.push(defaults[n])
      }
    })
  }

  
  return data
}

export default {
  name: 'IndexPage',

  computed: {
    ...mapState(['settings']),

    isDreaming: function () {
      return this.settings.servers.some(server => server.isDreaming)
    },

    isWakingUp: function () {
      return this.settings.servers.some(server => server.isWakingUp)
    },

    // @todo this smells like gefilte fish
    overallProgress: function () {
      if (!this.queue.length) {
        return 1
      } else {
        return this.settings.servers.length / this.queue.length
      }
    }
  },

  mounted () {
    // Handle autosave fields
    const $onloadData = store.get('txt2Img') || {}
    autosaveFields.forEach(key => {
      // Load settings
      if ($onloadData.hasOwnProperty(key)) {
        this[key] = $onloadData[key]
      }

      // Add autosave watchers
      this.$watch(key, this.autosave, {deep: true})
    })

    // Let's ping all servers on load to get current status
    this.settings.servers.forEach(server => {
      // Let's force-start checking
      server.isChecking = false
      
      // @todo Use a method instead of axios.create directly incase of update
      const api = axios.create({baseURL: server.base})

      this.checkDream(server, api)
    })
  },

  data: () => ({
    queue: [],
    tab: 'Images',
    prompt: '',
    negative: '',
    
    // @todo add this to config
    defaultPrompt: 'a dr seuss illustration of robots building a city',
    // @todo generate and persist this (and do we even need this?)
    sessionHash: '3exs9au2lti',

    lastImg: {},
    imgs: [],
    width: 512,
    height: 512,
    steps: 40,

    dreamCheckInterval: 750, // milliseconds

    numBatches: 1,
    batchSize: 1,

    totalBatched: 0,

    imageModal: false,
    imageModalActiveImage: null,
  }),
  
  methods: {
    /**
     * Queues up the dream and runs them if able to
     */
    queueDream () {
      // Exit if no servers
      if (!this.settings.servers.length) {
        this.$q.notify({
          message: 'No servers selected. Set one in Settings',
          position: 'top',
          color: 'red'
        })
        return
      }

      // Create the batch
      const batch = []
      for (let i = 0; i < this.batchSize; i++) {
        batch.push(sdDataScribe(this))
      }
      this.queue.push(...batch)

      // Check and start the next dream
      this.settings.servers.forEach(server => {
        if (!server.isChecking) {
          // Loop through each server and try to find an available one to run
          const api = axios.create({ baseURL: server.base })

          server.isChecking = true
          this.checkDream(server, api)
        }
      })

      // Save the queue to localstorage
      this.autosave()
    },

    /**
     * Check dream
     */
    checkDream (server, api) {
      console.log('checking dream...', server)
      api
      .post('/api/predict', {
        fn_index: 4,
        data: [],
        session_hash: this.sessionHash,
      })
      .then((response) => {
        const data = response.data.data[0]
        server.lastResponse = data

        // Pick up from where we left off
        if (data) {
          server.isDreaming = true
          server.isChecking = true
        } else {
          server.isDreaming = false
        }

        // If we're dreaming, update the progress
        // @todo handle multiple dreams
        if (server.isDreaming || response.data.isGenerating) {
          // Create a dummy DOM to extract the progress
          const $dom = document.createElement('div')
          $dom.innerHTML = data
          const $width = $dom.querySelector('.progress')

          // Update progress in UI
          if ($width?.innerHTML) {
            server.dreamProgress = parseInt($width.innerHTML.replace('%', ''))
          } else {
            server.dreamProgress = 0
          }

          // Check the dream again
          if (server.dreamProgress < 100) {
            setTimeout(() => {
              this.checkDream(server, api)
            }, this.dreamCheckInterval)
          } else {
            this.wakeUp()
          }

          // Update UI
          this.$nextTick(() => {
            this.$forceUpdate()
          })
        // Otherwise start dreaming if not dreaming
        } else if (!server.isDreaming && this.queue.length) {
          this.startDream(server, api)
        // Otherwise just chill
        } else {
        }
      })
      .catch(err => {
        this.$q.notify({
          color: 'negative',
          position: 'top',
          message: `Error checking dream: ${err}`,
          icon: 'report_problem',
        })
      })
    },

    /**
     * Starts the dream and occasionally checks in to update progress
     */
    startDream (server, api) {
      if (!this.queue.length) {
        return
      }
      
      // Start checking for progress
      server.isDreaming = true
      server.progress = 0
      this.$nextTick(() => {
        this.$forceUpdate()

        setTimeout(() => {
          this.checkDream(server, api)
        }, this.dreamCheckInterval)
      })

      // Actuall start dream
      const data = this.queue.shift()
      api
        .post('/api/predict', {
          fn_index: 3,
          data: data,
          session_hash: this.sessionHash,
        })
        .then((response) => {
          // Clean data
          const data = []
          response.data.data.forEach((val) => {
            data.push(val)
          })

          const imgs = []
          data[0].forEach((img) => {
            imgs.unshift(img)
          })

          this.imgs.unshift(...imgs)
          this.lastImg = this.imgs[this.imgs.length-1]

          // Run next in queue
          this.wakeUp(server)
          this.startDream(server, api)
        })
        .catch((err) => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Prompting failed: ${err}`,
            icon: 'report_problem',
          })
        })
    },

    /**
     * Frees up local data and allows the server to be pinged again
     */
    wakeUp (server) {
      server.isChecking = false
      server.isDreaming = false
      this.$nextTick(() => {
        this.$forceUpdate()
      })
    },

    stopServer (server) {
      const api = axios.create({baseURL: server.base})
      api
        .post('/api/predict', {
          fn_index: 5,
        })
        // @todo catch error
        .then(() => {
          this.wakeUp(server)
        })
        .catch((err) => {
          this.$q.notify({
            color: 'negative',
            position: 'top',
            message: `Stopping txt2Img failed: ${err}`,
            icon: 'report_problem',
          })
        })
    },

    // @todo Add this as a generic prototype
    // @todo Let's revisit how we save after vuex upgrade
    // @todo 🚨 This should be throttled
    autosave () {
      const data = {}
      autosaveFields.forEach(key => {
        data[key] = this[key]
      })
      store.set('txt2Img', data)
    },

    expandImage (ev) {
      this.imageModal = true
      this.imageModalActiveImage = ev
    },
  },
}
</script>

  