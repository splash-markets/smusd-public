import { getProvider } from './phantom.js';

const PROVIDER = getProvider();
const WALLET_ID = document.getElementById('wallet_id');
const BALANCE = document.getElementById('balance');
const CONNECTION = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'));
const PROGRAM_ID = new solanaWeb3.PublicKey('3QXWXyWGoodXqNqX86AjSacEfv9dgu4aauF3s3qCCwv2');
const MINT = new solanaWeb3.PublicKey('SMUSDBKt1cydTsvZmSHBS2CWAoi32FWPdFD7u9SwH3w');
const MINT_AUTH = new solanaWeb3.PublicKey('3iXwE1P6manizqC1pVaK4MVdNcqUtBKxJbCrDUMxHZmH');
const TOKEN_2022_PROGRAM_ID = new solanaWeb3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new solanaWeb3.PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

(async () => {
    const res = await CONNECTION.getAccountInfo(MINT_AUTH);
    const data_view = new DataView(res.data.buffer);
    const max_wallet_balance = data_view.getUint16(1, false);
    const description = `New users get 1000 SMUSD. Returning users can only top their wallet up to ${max_wallet_balance} SMUSD.
Markets are set up to consider this so bet carefully.`;
    document.getElementById('description').textContent = description;
})();

document.getElementById('wallet_btn').onclick = async () => {
    const wallet = (await PROVIDER.connect()).publicKey;
    update_sol_balance(wallet);
    WALLET_ID.textContent = wallet.toBase58();
};

document.getElementById('airdrop').onclick = async () => {
    const wallet_id = phantom.solana.publicKey;

    if (!wallet_id) {
        alert('Wallet is not connected');
        return;
    }

    const sg = await CONNECTION.requestAirdrop(wallet_id, solanaWeb3.LAMPORTS_PER_SOL);
    await CONNECTION.confirmTransaction(sg);

    update_sol_balance(wallet_id);
    //play splash audio
    console.log(sg);
};

document.getElementById('smusdc_form').onsubmit = async e => {
    e.preventDefault();
    const wallet_id = phantom.solana.publicKey;

    if (!wallet_id) {
        alert('Wallet is not connected');
        return;
    }

    const ata = await get_smusdc_ata(wallet_id);
    console.log(`Token account: ${ata.toBase58()}`);
    const tx = new solanaWeb3.Transaction().add(mint_smusdc(wallet_id, ata));
    console.log(await sign_and_send_tx(tx));
}

function mint_smusdc(wallet_id, ata) {
    return new solanaWeb3.TransactionInstruction({
        data: new Uint8Array([0]),
        programId: PROGRAM_ID,
        keys: [
            { isSigner: true, isWritable: false, pubkey: wallet_id },
            { isSigner: false, isWritable: false, pubkey: MINT_AUTH },
            { isSigner: false, isWritable: true, pubkey: ata },
            { isSigner: false, isWritable: true, pubkey: MINT },
            { isSigner: false, isWritable: false, pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY },
            { isSigner: false, isWritable: false, pubkey: TOKEN_2022_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: solanaWeb3.SystemProgram.programId }
        ]
    });
}

function get_smusdc_ata(wallet_id) {
    return solanaWeb3.PublicKey.findProgramAddressSync(
        [
            wallet_id.toBytes(),
            TOKEN_2022_PROGRAM_ID.toBytes(),
            MINT.toBytes()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}

async function sign_and_send_tx(tx) {
    const feePayer = phantom.solana.publicKey;

    if (!feePayer) {
        alert('Wallet is not connected');
        return;
    }

    tx.feePayer = feePayer;
    tx.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
    return phantom.solana.signAndSendTransaction(tx);
}

async function update_sol_balance(wallet) {
    const res = await CONNECTION.getAccountInfo(wallet);
    BALANCE.textContent = `Balance: ${res.lamports / 1e9} sols`;
}
