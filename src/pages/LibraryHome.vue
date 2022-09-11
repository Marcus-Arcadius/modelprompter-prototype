<template lang="pug">
q-page.full-height
  section.content
    h1 Library

    h4 Diffusion Blocks
    DiffblocksTable

    h4 Building blocks
    BlocksGrid
</template>

<script>
import BlocksGrid from '../components/library/BlocksGrid'
import DiffblocksTable from '../components/library/DiffblocksTable'
import {mapState} from 'vuex'
import store from 'store'

export default {
  name: 'LibraryHome',

  components: {BlocksGrid, DiffblocksTable}
}
</script>