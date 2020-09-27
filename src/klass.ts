async function createDbRecordFor(tableName: string, attrs: any) {
  return null
}

class DataLayerBase {
  public createDbRecordFor = createDbRecordFor
}
export default DataLayerBase