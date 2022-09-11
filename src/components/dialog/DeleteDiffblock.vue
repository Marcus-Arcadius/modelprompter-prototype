<template lang="pug">
DialogConfirm(:value='value' @input='$emit("input", $event)'
  @accept='deleteDiffblock'
  bg='negative'
  icon='fas fa-trash'
  title='Delete block?')
    p Are you sure you want to delete this block? This cannot be undone!
</template>

<script>
import DialogConfirm from './Confirm'
import {mapState} from 'vuex'
import store from 'store'

export default {
  name: 'DialogDeleteDiffblock',

  components: {DialogConfirm},

  computed: {
    ...mapState(['diffblocks'])
  },

  props: ['value', 'diffblock'],

  methods: {
    /**
     * Deletes the block and creates a new one
     */
    deleteDiffblock () {
      let title = this.diffblocks[this.diffblock.uuid].title
      let diffblocks = Object.assign({}, this.diffblocks)
      let currentStudio = store.get('currentStudio', {})

      // Delete diffblock
      delete diffblocks[this.diffblock.uuid]
      this.$store.commit('set', ['diffblocks', diffblocks])
      store.set('diffblocks', diffblocks)

      // Reset Studio
      if (this.diffblock.uuid === currentStudio.uuid) {
        store.remove('currentStudio')
      }

      // Notifications
      this.$q.notify({
        type: 'positive',
        message: `Block "${title}" deleted`,
        timeout: 2000
      })
      this.$store.commit('set', ['lastEvent', {log: `Block "${title}" deleted`}])

      // Reroute
      if (this.$route.name === 'Studio') {
        this.$store.commit('tally', 'reloads')
      }
    }
  }
}
</script>