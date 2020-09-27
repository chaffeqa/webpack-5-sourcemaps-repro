import {AvailableOptionEnum} from "./enums"
import DataLayer from "./klass"

console.log(`created: ${AvailableOptionEnum.AVAILABLE}`)

const f = async () => {
  const d = new DataLayer()
  await d.createDbRecordFor("s", "e")
}
console.log('calling')
f().then(() => console.log('called'))
