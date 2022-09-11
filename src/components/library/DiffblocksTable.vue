<template lang="pug">
div
  q-table.diffblocks-table(:data='diffblockValues' :columns='columns' row-key='uuid')
    template(v-slot:body-cell-actions='props')
      q-td(:props='props')
        q-btn.q-mr-lg(size='sm' color='secondary' @click='loadDiffblock(props)' icon='fas fa-folder-open') Load
        q-btn.q-mr-lg(size='sm' color='tertiary' @click='remixDiffblock(props)' icon='fas fa-copy') Remix
        q-btn(size='sm' color='negative' @click='deleteDiffblock(props)' icon='fas fa-trash') Delete
  DialogDeleteDiffblock(v-model='dialog.deleteDiffblock' :diffblock='dialogDiffblock')
</template>

<script>
import store from 'store'
import {mapState} from 'vuex'
import DialogDeleteDiffblock from '../dialog/DeleteDiffblock'
import {v4 as uuidv4} from 'uuid'

/**
 * Displays a table containing all available diffblocks
 */
export default {
  name: 'DiffblocksTable',

  components: {DialogDeleteDiffblock},

  computed: {
    ...mapState(['diffblocks']),

    diffblockValues () {
      return Object.values(this.diffblocks)
    }
  },

  data () {
    return {
      // The diffblock to use inside a dialog
      dialogDiffblock: null,
      
      // Dialog models
      dialog: {
        deleteDiffblock: false
      },
      
      // Table columns
      columns: [
        {
          label: 'Title',
          field: 'title',
          name: 'title',
          sortable: true,
          align: 'left'
        },
        {
          label: 'Description',
          field: 'description',
          name: 'description',
          sortable: true,
          align: 'left'
        },
        {
          label: 'Actions',
          name: 'actions',
          align: 'left'
        }
      ]
    }
  },

  methods: {
    /**
     * Loads the diffblock
     */
    loadDiffblock (props) {
      const diffblock = this.diffblocks[props.key]
      
      // Load block
      store.set('currentStudio', diffblock)
      this.$q.notify({
        type: 'positive',
        message: `Difflock "${diffblock.title}" loaded!`,
        timeout: 3000
      })

      // Reroute
      if (this.$route.name === 'Studio') {
        this.$store.commit('tally', 'reloads')
      } else {
        this.$router.push({name: 'Studio'})
      }
    },

    /**
     * Delete the diffblock
     */
    deleteDiffblock (props) {
      this.dialogDiffblock = this.diffblocks[props.key]
      this.dialog.deleteDiffblock = true
    },

    /**
     * Remix a diffblock
     */
    remixDiffblock (props) {
      const block = Object.assign({}, this.diffblocks[props.key])
      block.uuid = uuidv4()
      block.title += ' [Remixed]'

      this.$store.commit('set', [`diffblocks["${block.uuid}"]`, block])
      store.set('currentStudio', block)
      store.set('isStudioUnsaved', false)
      store.set('diffblocks', this.diffblocks)
      this.$q.notify({
        type: 'positive',
        message: `Difflock "${block.title}" remixed!`,
        timeout: 3000
      })

      // Reroute
      if (this.$route.name === 'Studio') {
        this.$store.commit('tally', 'reloads')
      } else {
        this.$router.push({name: 'Studio'})
      }
    }
  }
}
</script>

<style lang="sass">
.diffblocks-table tbody tr td:nth-child(1)
  font-size: 1.25em
  font-weight: bold
.diffblocks-table tbody tr td:nth-child(2)
  white-space: pre-wrap
</style>