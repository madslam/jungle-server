export const getRoom = async (db,id) => {
    const roomRef = await db.collection ('rooms').doc (id).get ();
  
    return roomRef.exists ? {...roomRef.data (), id: roomRef.id} : null;
};
  
export const updatePlayerRoom = async (db, room) => {
    const roomRef = db.collection ('rooms').doc (room.id);
    const full = room.players === room.game.numberPlayer ? true : false;
    await roomRef.update ({playersConnected: room.players, full});
}