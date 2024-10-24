import React, { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
    Connection, PublicKey, Transaction, LAMPORTS_PER_SOL,
    TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

const CONNECTION = new Connection("https://devnet.helius-rpc.com/?api-key=1fe7d1fb-c283-404e-8bf4-231484ec3251");
const PROGRAM_ID = new PublicKey('3QXWXyWGoodXqNqX86AjSacEfv9dgu4aauF3s3qCCwv2');
const MINT = new PublicKey('SMUSDBKt1cydTsvZmSHBS2CWAoi32FWPdFD7u9SwH3w');
const MINT_AUTH = new PublicKey('3iXwE1P6manizqC1pVaK4MVdNcqUtBKxJbCrDUMxHZmH');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

 
export default () => (
    <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
            <Header />
            <Main><WalletMultiButton /></Main>
        </WalletModalProvider>
    </WalletProvider>
);


function Header() {
    return (
        <header>
            <img src="./icon.png" alt="token icon" />
            <h1>SMUSD Faucet</h1>
        </header>
    );
}


function Main(props) {
    const [balanceInfo, setBalanceInfo] = useState('');
    const [description, setDescription] = useState('');
    const { connected, wallet } = useWallet();

    const update_sol_balance = () => {
        if (!connected) return;
        const wallet_id = wallet?.adapter.publicKey;

        if (wallet_id instanceof PublicKey) {
            CONNECTION.getAccountInfo(wallet_id)
                .then(res => {
                    res?.lamports && setBalanceInfo(`Balance: ${res.lamports / 1e9} sol`);
                });
        }
    };

    const airdrop = async () => {
        if (!connected) {
            alert('Wallet is not connected');
            return;
        }

        const wallet_id = wallet?.adapter.publicKey;

        if (wallet_id instanceof PublicKey) {
            let sg;

            try {
                sg = await CONNECTION.requestAirdrop(wallet_id, LAMPORTS_PER_SOL);
            } catch (err) {
                console.error(err);
                alert('An error occured. Try again later.');
                return;
            }

            await CONNECTION.confirmTransaction(sg, 'finalized');

            update_sol_balance();
            //play splash audio
            console.log(sg);
            alert('Airdroped 1 Sol.');
        }
    };

    const submitHandler = async e => {
        e.preventDefault();

        if (!connected) {
            alert('Wallet is not connected');
            return;
        }

        const adapter = wallet?.adapter;

        if (adapter && 'signTransaction' in adapter) {
            const wallet_key = adapter.publicKey;

            if (wallet_key instanceof PublicKey) {
                const ata = get_smusdc_ata(wallet_key);
                console.log(`Token account: ${ata.toBase58()}`);

                const tx = new Transaction().add(mint_smusdc(wallet_key, ata));
                tx.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
                tx.feePayer = wallet_key;

                const signed_tx = await adapter.signTransaction(tx);
                let sg;

                try {
                    sg = await CONNECTION.sendRawTransaction(signed_tx.serialize());
                } catch (err) {
                    console.error(err);
                    alert('An error occured. Check if you already have max number of SMUSD tokens');
                    return;
                }

                const confirmation = CONNECTION.confirmTransaction(sg, 'finalized');

                console.log(sg);
                alert('Transaction finished. Check your wallet.');

                await confirmation;
                update_sol_balance();
            }
        }
    };

    useEffect(update_sol_balance, [connected]);

    useEffect(() => {
        CONNECTION.getAccountInfo(MINT_AUTH)
        .then(res => {
            if (!res) return;        
            const max_wallet_balance = new DataView(res.data.buffer).getUint16(1, false);
            const str = `New users get 1000 SMUSD. Returning users can only top their wallet up to ${max_wallet_balance} SMUSD. Markets are set up to consider this so bet carefully.`;
            setDescription(str);
        });
    }, []);

    return (
        <main>
            <div id="info">
                <h3>Switch your wallet to devnet to avoid the warnings from Phantom.</h3>
                <p>Open Phantom, click your wallet on top left, click the cog bottom right, Developer Settings, Testnet Mode.</p>
            </div>

            {props.children}<br />

            <button onClick={airdrop}>Get 1 devnet SOL if you need some.</button><br />
            <span id="balance">{balanceInfo}</span>

            <form onSubmit={submitHandler}>
                <h2>Now get SMUSD</h2>
                <p>{description}</p>
                <input type="submit" value="Ok, gimme SMUSD" />
            </form>
        </main>
    );
}

function mint_smusdc(wallet_id, ata) {
    return new TransactionInstruction({
        data: new Uint8Array([0]),
        programId: PROGRAM_ID,
        keys: [
            { isSigner: true, isWritable: false, pubkey: wallet_id },
            { isSigner: false, isWritable: false, pubkey: MINT_AUTH },
            { isSigner: false, isWritable: true, pubkey: ata },
            { isSigner: false, isWritable: true, pubkey: MINT },
            { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
            { isSigner: false, isWritable: false, pubkey: TOKEN_2022_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID },
            { isSigner: false, isWritable: false, pubkey: SystemProgram.programId }
        ]
    });
}

function get_smusdc_ata(wallet_id) {
    return PublicKey.findProgramAddressSync(
        [
            wallet_id.toBytes(),
            TOKEN_2022_PROGRAM_ID.toBytes(),
            MINT.toBytes()
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}
